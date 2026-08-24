use std::collections::HashMap;
use std::fmt::Write as FmtWrite;
use std::io::{Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sha2::{Digest, Sha256};
use ssh2::{
    CheckResult, ErrorCode, KnownHostFileKind, OpenFlags, OpenType, RenameFlags, Session, Sftp,
};
use uuid::Uuid;
use zeroize::Zeroize;

use super::error::{CommandError, CommandResult};
use super::model::{
    AuthenticationMethod, ConnectionProfileRequest, ConnectionRequest, ConnectionResult,
    LibraryObjectEntry, LibraryObjectsRequest, LibraryObjectsResult, SourceMemberEntry,
    SourceMemberReadRequest, SourceMemberReadResult, SourceMembersRequest, SourceMembersResult,
    WorkspaceReadRequest, WorkspaceReadResult, WorkspaceWriteRequest, WorkspaceWriteResult,
};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
const SESSION_TIMEOUT_MS: u32 = 30_000;
const SFTP_NO_SUCH_FILE: i32 = 2;
const MAX_WORKSPACE_BYTES: usize = 4 * 1024 * 1024;
const MAX_CATALOG_ENTRIES: usize = 20_000;
const MAX_SOURCE_MEMBER_BYTES: usize = 16 * 1024 * 1024;

#[derive(Clone, Default)]
pub struct IbmiSessionStore {
    sessions: Arc<Mutex<HashMap<String, SharedSession>>>,
}

type SharedSession = Arc<Mutex<IbmiSessionTransport>>;

struct IbmiSessionTransport {
    ssh: Session,
    sftp: Option<Sftp>,
}

impl IbmiSessionTransport {
    fn new(ssh: Session) -> Self {
        Self { ssh, sftp: None }
    }

    fn sftp(&mut self) -> CommandResult<&Sftp> {
        if self.sftp.is_none() {
            self.sftp = Some(
                self.ssh
                    .sftp()
                    .map_err(|error| CommandError::new("IBMI_SFTP", error.to_string()))?,
            );
        }
        self.sftp
            .as_ref()
            .ok_or_else(|| CommandError::new("IBMI_SFTP", "SFTP channel is unavailable."))
    }

    fn close_sftp(&mut self) -> CommandResult<()> {
        if let Some(mut sftp) = self.sftp.take() {
            sftp.shutdown()
                .map_err(|error| CommandError::new("IBMI_SFTP_SHUTDOWN", error.to_string()))?;
        }
        Ok(())
    }
}

impl IbmiSessionStore {
    pub fn connect(&self, mut request: ConnectionRequest) -> CommandResult<ConnectionResult> {
        let result = self.connect_with_secret(&request.profile, request.secret.as_deref());
        if let Some(secret) = request.secret.as_mut() {
            secret.zeroize();
        }
        result
    }

    fn connect_with_secret(
        &self,
        profile: &ConnectionProfileRequest,
        secret: Option<&str>,
    ) -> CommandResult<ConnectionResult> {
        self.validate_profile(&profile)?;
        let tcp = connect_tcp(&profile.host, profile.port)?;
        tcp.set_read_timeout(Some(CONNECT_TIMEOUT))
            .map_err(|error| CommandError::new("IBMI_TCP_CONFIG", error.to_string()))?;
        tcp.set_write_timeout(Some(CONNECT_TIMEOUT))
            .map_err(|error| CommandError::new("IBMI_TCP_CONFIG", error.to_string()))?;

        let mut session = Session::new()
            .map_err(|error| CommandError::new("IBMI_SSH_SESSION", error.to_string()))?;
        session.set_timeout(SESSION_TIMEOUT_MS);
        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|error| CommandError::new("IBMI_SSH_HANDSHAKE", error.to_string()))?;
        verify_host_key(&session, &profile.host, profile.port)?;

        match profile.authentication {
            AuthenticationMethod::Agent => session
                .userauth_agent(&profile.username)
                .map_err(|error| CommandError::new("IBMI_SSH_AUTHENTICATION", error.to_string()))?,
            AuthenticationMethod::Password => {
                let password = secret.filter(|value| !value.is_empty()).ok_or_else(|| {
                    CommandError::new(
                        "IBMI_PASSWORD_REQUIRED",
                        "A password is required for this IBM i connection profile.",
                    )
                })?;
                session
                    .userauth_password(&profile.username, password)
                    .map_err(|_| {
                        CommandError::new(
                            "IBMI_SSH_AUTHENTICATION",
                            "The IBM i server did not accept the user name or password.",
                        )
                    })?;
            }
            AuthenticationMethod::PrivateKey => {
                return Err(CommandError::new(
                    "IBMI_AUTHENTICATION_UNSUPPORTED",
                    "Direct private-key authentication is not available in this desktop build.",
                ));
            }
        }
        if !session.authenticated() {
            return Err(CommandError::new(
                "IBMI_SSH_AUTHENTICATION",
                "The SSH server did not accept the selected authentication method.",
            ));
        }

        let session_id = Uuid::new_v4().to_string();
        self.sessions
            .lock()
            .map_err(|_| CommandError::new("IBMI_SESSION_STATE", "Session state is unavailable."))?
            .insert(
                session_id.clone(),
                Arc::new(Mutex::new(IbmiSessionTransport::new(session))),
            );
        Ok(ConnectionResult {
            id: session_id,
            system_name: profile.host.to_uppercase(),
            release: None,
            job_name: None,
            current_library: profile.default_library.clone(),
            library_list: profile.library_list.clone(),
        })
    }

    pub fn disconnect(&self, session_id: &str) -> CommandResult<()> {
        let session = self
            .sessions
            .lock()
            .map_err(|_| CommandError::new("IBMI_SESSION_STATE", "Session state is unavailable."))?
            .remove(session_id)
            .ok_or_else(|| CommandError::new("IBMI_SESSION_NOT_FOUND", "Unknown IBM i session."))?;
        let mut transport = lock_session(&session)?;
        transport.close_sftp()?;
        transport
            .ssh
            .disconnect(None, "IronTerm Studio disconnected", None)
            .map_err(|error| CommandError::new("IBMI_SSH_DISCONNECT", error.to_string()))
    }

    pub fn list_library_objects(
        &self,
        request: LibraryObjectsRequest,
    ) -> CommandResult<LibraryObjectsResult> {
        let library = system_name(&request.library, "library")?;
        let session = self.session(&request.session_id)?;
        let mut transport = lock_session(&session)?;
        let path = format!("/QSYS.LIB/{library}.LIB");
        let entries = read_directory(transport.sftp()?, &path, "IBMI_LIBRARY_LIST")?;
        let mut objects = entries
            .into_iter()
            .filter_map(|(path, stat)| {
                let file_name = path.file_name()?.to_str()?;
                let (name, object_type) = qsys_entry_name(file_name)?;
                Some(LibraryObjectEntry {
                    name,
                    is_source_file: object_type == "FILE" && stat.is_dir(),
                    object_type,
                    size: stat.size,
                    modified_at: stat.mtime,
                })
            })
            .collect::<Vec<_>>();
        ensure_catalog_size(objects.len())?;
        objects.sort_unstable_by(|left, right| {
            right
                .is_source_file
                .cmp(&left.is_source_file)
                .then_with(|| left.name.cmp(&right.name))
                .then_with(|| left.object_type.cmp(&right.object_type))
        });
        Ok(LibraryObjectsResult { library, objects })
    }

    pub fn list_source_members(
        &self,
        request: SourceMembersRequest,
    ) -> CommandResult<SourceMembersResult> {
        let library = system_name(&request.library, "library")?;
        let source_file = system_name(&request.source_file, "source file")?;
        let session = self.session(&request.session_id)?;
        let mut transport = lock_session(&session)?;
        transport.close_sftp()?;
        let command =
            format!("system \"DSPFD FILE({library}/{source_file}) TYPE(*MBRLIST) OUTPUT(*PRINT)\"");
        let output =
            execute_remote_command_output(&transport.ssh, &command, "IBMI_SOURCE_MEMBER_LIST")?;
        let mut members = parse_source_member_catalog(&output)?;
        ensure_catalog_size(members.len())?;
        members.sort_unstable_by(|left, right| left.name.cmp(&right.name));
        Ok(SourceMembersResult {
            library,
            source_file,
            members,
        })
    }

    pub fn read_source_member(
        &self,
        request: SourceMemberReadRequest,
    ) -> CommandResult<SourceMemberReadResult> {
        let library = system_name(&request.library, "library")?;
        let source_file = system_name(&request.source_file, "source file")?;
        let member = system_name(&request.member, "source member")?;
        let source_ccsid = source_ccsid(&request.source_ccsid)?;
        let session = self.session(&request.session_id)?;
        let mut transport = lock_session(&session)?;
        let member_path = format!("/QSYS.LIB/{library}.LIB/{source_file}.FILE/{member}.MBR");
        let staging_path = source_staging_path(transport.sftp()?)?;
        transport.close_sftp()?;
        let command = format!(
            "system \"CPYTOSTMF FROMMBR('{member_path}') TOSTMF('{staging_path}') \
             STMFOPT(*REPLACE) CVTDTA(*AUTO) DBFCCSID({source_ccsid}) \
             STMFCCSID(1208) ENDLINFMT(*LF)\""
        );

        let result = (|| {
            execute_remote_command(&transport.ssh, &command, "IBMI_SOURCE_CONVERT")?;
            let bytes = read_source_staging_file(transport.sftp()?, &staging_path)?;
            let text = String::from_utf8(bytes)
                .map_err(|error| CommandError::new("IBMI_SOURCE_ENCODING", error.to_string()))?;
            Ok(SourceMemberReadResult {
                library,
                source_file,
                member,
                revision: revision(text.as_bytes()),
                text,
            })
        })();
        let cleanup = remove_sftp_file(transport.sftp()?, &staging_path);
        match (result, cleanup) {
            (Err(error), _) => Err(error),
            (Ok(_), Err(error)) => Err(error),
            (Ok(value), Ok(())) => Ok(value),
        }
    }

    pub fn read_workspace(
        &self,
        request: WorkspaceReadRequest,
    ) -> CommandResult<WorkspaceReadResult> {
        validate_workspace_path(&request.path)?;
        let session = self.session(&request.session_id)?;
        let mut transport = lock_session(&session)?;
        let bytes = read_sftp_file(transport.sftp()?, &request.path)?;
        let text = String::from_utf8(bytes.clone())
            .map_err(|error| CommandError::new("IBMI_WORKSPACE_ENCODING", error.to_string()))?;
        Ok(WorkspaceReadResult {
            text,
            revision: revision(&bytes),
        })
    }

    pub fn write_workspace(
        &self,
        request: WorkspaceWriteRequest,
    ) -> CommandResult<WorkspaceWriteResult> {
        validate_workspace_path(&request.path)?;
        if request.text.len() > MAX_WORKSPACE_BYTES {
            return Err(CommandError::new(
                "IBMI_WORKSPACE_TOO_LARGE",
                "Workspace manifests cannot exceed 4 MiB.",
            ));
        }
        let session = self.session(&request.session_id)?;
        let mut transport = lock_session(&session)?;
        let current = read_optional_sftp_file(transport.sftp()?, &request.path)?;
        let actual_revision = current.as_deref().map(revision);
        if actual_revision != request.expected_revision {
            return Err(CommandError::revision_conflict(
                &request.path,
                request.expected_revision,
                actual_revision,
            ));
        }

        write_sftp_file(transport.sftp()?, &request.path, request.text.as_bytes())?;
        Ok(WorkspaceWriteResult {
            revision: revision(request.text.as_bytes()),
        })
    }

    fn session(&self, session_id: &str) -> CommandResult<SharedSession> {
        self.sessions
            .lock()
            .map_err(|_| CommandError::new("IBMI_SESSION_STATE", "Session state is unavailable."))?
            .get(session_id)
            .cloned()
            .ok_or_else(|| CommandError::new("IBMI_SESSION_NOT_FOUND", "Unknown IBM i session."))
    }

    fn validate_profile(&self, profile: &ConnectionProfileRequest) -> CommandResult<()> {
        if profile.profile_id.trim().is_empty()
            || profile.name.trim().is_empty()
            || profile.host.trim().is_empty()
            || profile.username.trim().is_empty()
        {
            return Err(CommandError::new(
                "IBMI_PROFILE_INVALID",
                "Profile, host, and IBM i user name are required.",
            ));
        }
        Ok(())
    }
}

fn lock_session(
    session: &SharedSession,
) -> CommandResult<std::sync::MutexGuard<'_, IbmiSessionTransport>> {
    session
        .lock()
        .map_err(|_| CommandError::new("IBMI_SESSION_STATE", "IBM i session is unavailable."))
}

fn read_directory(
    sftp: &Sftp,
    path: &str,
    error_code: &'static str,
) -> CommandResult<Vec<(PathBuf, ssh2::FileStat)>> {
    sftp.readdir(Path::new(path))
        .map_err(|error| CommandError::new(error_code, error.to_string()))
}

fn execute_remote_command(
    session: &Session,
    command: &str,
    error_code: &'static str,
) -> CommandResult<()> {
    execute_remote_command_output(session, command, error_code).map(|_| ())
}

fn execute_remote_command_output(
    session: &Session,
    command: &str,
    error_code: &'static str,
) -> CommandResult<Vec<u8>> {
    let mut channel = session
        .channel_session()
        .map_err(|error| CommandError::new(error_code, error.to_string()))?;
    channel
        .exec(command)
        .map_err(|error| CommandError::new(error_code, error.to_string()))?;
    let mut stdout = Vec::new();
    channel
        .read_to_end(&mut stdout)
        .map_err(|error| CommandError::new(error_code, error.to_string()))?;
    let mut stderr = Vec::new();
    channel
        .stderr()
        .read_to_end(&mut stderr)
        .map_err(|error| CommandError::new(error_code, error.to_string()))?;
    channel
        .wait_close()
        .map_err(|error| CommandError::new(error_code, error.to_string()))?;
    let exit_status = channel
        .exit_status()
        .map_err(|error| CommandError::new(error_code, error.to_string()))?;
    if exit_status == 0 {
        return Ok(stdout);
    }
    let output = if stderr.is_empty() { stdout } else { stderr };
    let detail = String::from_utf8_lossy(&output).trim().to_owned();
    Err(CommandError::new(
        error_code,
        if detail.is_empty() {
            format!("IBM i command failed with exit status {exit_status}.")
        } else {
            detail
        },
    ))
}

fn parse_source_member_catalog(output: &[u8]) -> CommandResult<Vec<SourceMemberEntry>> {
    let mut members = Vec::new();
    for line in String::from_utf8_lossy(output).lines() {
        let columns = line.split_whitespace().collect::<Vec<_>>();
        if columns.len() < 3
            || !columns[1]
                .chars()
                .all(|character| character.is_ascii_digit())
        {
            continue;
        }
        let Ok(name) = system_name(columns[0], "source member") else {
            continue;
        };
        let source_type = if looks_like_report_date(columns[2]) {
            String::new()
        } else {
            optional_source_type(columns[2])?
        };
        members.push(SourceMemberEntry {
            name,
            source_type,
            size: None,
            modified_at: None,
        });
    }
    Ok(members)
}

fn looks_like_report_date(value: &str) -> bool {
    value.len() >= 6
        && value
            .chars()
            .all(|character| character.is_ascii_digit() || matches!(character, '/' | '-' | '.'))
        && value
            .chars()
            .any(|character| matches!(character, '/' | '-' | '.'))
}

fn optional_source_type(value: &str) -> CommandResult<String> {
    let source_type = value.trim().to_ascii_uppercase();
    if source_type.is_empty() {
        return Ok(String::new());
    }
    system_name(&source_type, "source type")
}

fn read_source_staging_file(sftp: &Sftp, path: &str) -> CommandResult<Vec<u8>> {
    let file = sftp
        .open(Path::new(path))
        .map_err(|error| CommandError::new("IBMI_SOURCE_READ", error.to_string()))?;
    let mut bytes = Vec::new();
    file.take((MAX_SOURCE_MEMBER_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| CommandError::new("IBMI_SOURCE_READ", error.to_string()))?;
    if bytes.len() > MAX_SOURCE_MEMBER_BYTES {
        return Err(CommandError::new(
            "IBMI_SOURCE_TOO_LARGE",
            "Source members cannot exceed 16 MiB.",
        ));
    }
    Ok(bytes)
}

fn source_staging_path(sftp: &Sftp) -> CommandResult<String> {
    let home = sftp
        .realpath(Path::new("."))
        .map_err(|error| CommandError::new("IBMI_SOURCE_STAGING", error.to_string()))?;
    let path = home
        .join(".ironterm")
        .join("staging")
        .join(format!("{}.source", Uuid::new_v4()));
    let value = path.to_str().ok_or_else(|| {
        CommandError::new("IBMI_SOURCE_STAGING", "IBM i home path is not valid UTF-8.")
    })?;
    ensure_parent_directories(sftp, value, "IBMI_SOURCE_STAGING")?;
    Ok(value.to_owned())
}

fn remove_sftp_file(sftp: &Sftp, path: &str) -> CommandResult<()> {
    sftp.unlink(Path::new(path))
        .map_err(|error| CommandError::new("IBMI_SOURCE_CLEANUP", error.to_string()))
}

fn qsys_entry_name(file_name: &str) -> Option<(String, String)> {
    let (name, object_type) = file_name.rsplit_once('.')?;
    if name.is_empty() || object_type.is_empty() {
        return None;
    }
    Some((name.to_owned(), object_type.to_owned()))
}

fn system_name(value: &str, label: &str) -> CommandResult<String> {
    let name = value.trim().to_ascii_uppercase();
    let mut characters = name.chars();
    let first = characters.next();
    let valid_first = first.is_some_and(|character| {
        character.is_ascii_alphabetic() || matches!(character, '$' | '#' | '@')
    });
    let valid_rest = characters.all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '_' | '$' | '#' | '@')
    });
    if name.len() > 10 || !valid_first || !valid_rest {
        return Err(CommandError::new(
            "IBMI_SYSTEM_NAME",
            format!("Invalid IBM i {label} system name: {value}"),
        ));
    }
    Ok(name)
}

fn source_ccsid(value: &str) -> CommandResult<String> {
    let normalized = value.trim().to_ascii_uppercase();
    if normalized.is_empty() || normalized == "*FILE" {
        return Ok("*FILE".to_owned());
    }
    let number = normalized.parse::<u32>().map_err(|_| {
        CommandError::new(
            "IBMI_SOURCE_CCSID",
            format!("Invalid IBM i source CCSID: {value}"),
        )
    })?;
    if !(1..=65_533).contains(&number) {
        return Err(CommandError::new(
            "IBMI_SOURCE_CCSID",
            format!("Invalid IBM i source CCSID: {value}"),
        ));
    }
    Ok(number.to_string())
}

fn ensure_catalog_size(size: usize) -> CommandResult<()> {
    if size > MAX_CATALOG_ENTRIES {
        return Err(CommandError::new(
            "IBMI_CATALOG_TOO_LARGE",
            format!("IBM i catalogs cannot exceed {MAX_CATALOG_ENTRIES} entries."),
        ));
    }
    Ok(())
}

fn connect_tcp(host: &str, port: u16) -> CommandResult<TcpStream> {
    let addresses = (host, port)
        .to_socket_addrs()
        .map_err(|error| CommandError::new("IBMI_HOST_RESOLUTION", error.to_string()))?;
    let mut last_error = None;
    for address in addresses {
        match TcpStream::connect_timeout(&address, CONNECT_TIMEOUT) {
            Ok(stream) => return Ok(stream),
            Err(error) => last_error = Some(error),
        }
    }
    Err(CommandError::new(
        "IBMI_TCP_CONNECT",
        last_error
            .map(|error| error.to_string())
            .unwrap_or_else(|| "The host did not resolve to an address.".to_owned()),
    ))
}

fn verify_host_key(session: &Session, host: &str, port: u16) -> CommandResult<()> {
    let known_hosts_path = known_hosts_path()?;
    let mut known_hosts = session
        .known_hosts()
        .map_err(|error| CommandError::new("IBMI_HOST_KEY", error.to_string()))?;
    known_hosts
        .read_file(&known_hosts_path, KnownHostFileKind::OpenSSH)
        .map_err(|error| CommandError::new("IBMI_KNOWN_HOSTS", error.to_string()))?;
    let (host_key, _) = session.host_key().ok_or_else(|| {
        CommandError::new(
            "IBMI_HOST_KEY",
            "The SSH server did not provide a host key.",
        )
    })?;
    let port_result = known_hosts.check_port(host, port, host_key);
    let bracketed_result =
        (port != 22).then(|| known_hosts.check(&format!("[{host}]:{port}"), host_key));
    match (port_result, bracketed_result) {
        (CheckResult::Match, _) | (_, Some(CheckResult::Match)) => Ok(()),
        (CheckResult::Mismatch, _) | (_, Some(CheckResult::Mismatch)) => Err(CommandError::new(
            "IBMI_HOST_KEY_MISMATCH",
            "The IBM i host key does not match the trusted known_hosts entry.",
        )),
        (CheckResult::NotFound, _) | (_, Some(CheckResult::NotFound)) => Err(CommandError::new(
            "IBMI_HOST_KEY_UNKNOWN",
            "The IBM i host key is not trusted. Add it to OpenSSH known_hosts first.",
        )),
        _ => Err(CommandError::new(
            "IBMI_HOST_KEY",
            "The IBM i host key could not be verified.",
        )),
    }
}

fn known_hosts_path() -> CommandResult<PathBuf> {
    let path = dirs::home_dir()
        .ok_or_else(|| CommandError::new("IBMI_KNOWN_HOSTS", "User home is unavailable."))?
        .join(".ssh")
        .join("known_hosts");
    if !path.is_file() {
        return Err(CommandError::new(
            "IBMI_KNOWN_HOSTS",
            format!("OpenSSH known_hosts was not found at {}.", path.display()),
        ));
    }
    Ok(path)
}

fn read_sftp_file(sftp: &Sftp, path: &str) -> CommandResult<Vec<u8>> {
    let file = sftp
        .open(Path::new(path))
        .map_err(|error| CommandError::new("IBMI_WORKSPACE_READ", error.to_string()))?;
    let mut bytes = Vec::new();
    file.take((MAX_WORKSPACE_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| CommandError::new("IBMI_WORKSPACE_READ", error.to_string()))?;
    ensure_workspace_size(bytes.len())?;
    Ok(bytes)
}

fn read_optional_sftp_file(sftp: &Sftp, path: &str) -> CommandResult<Option<Vec<u8>>> {
    let file = match sftp.open(Path::new(path)) {
        Ok(file) => file,
        Err(error) if error.code() == ErrorCode::SFTP(SFTP_NO_SUCH_FILE) => return Ok(None),
        Err(error) => {
            return Err(CommandError::new("IBMI_WORKSPACE_READ", error.to_string()));
        }
    };
    let mut bytes = Vec::new();
    file.take((MAX_WORKSPACE_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| CommandError::new("IBMI_WORKSPACE_READ", error.to_string()))?;
    ensure_workspace_size(bytes.len())?;
    Ok(Some(bytes))
}

fn write_sftp_file(sftp: &Sftp, path: &str, bytes: &[u8]) -> CommandResult<()> {
    ensure_parent_directories(sftp, path, "IBMI_WORKSPACE_DIRECTORY")?;
    let temporary_path = format!("{path}.ironterm-{}.tmp", Uuid::new_v4());
    let mut file = sftp
        .open_mode(
            Path::new(&temporary_path),
            OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
            0o600,
            OpenType::File,
        )
        .map_err(|error| CommandError::new("IBMI_WORKSPACE_WRITE", error.to_string()))?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.flush()) {
        drop(file);
        let _cleanup_result = sftp.unlink(Path::new(&temporary_path));
        return Err(CommandError::new("IBMI_WORKSPACE_WRITE", error.to_string()));
    }
    drop(file);
    if let Err(error) = sftp.rename(
        Path::new(&temporary_path),
        Path::new(path),
        Some(RenameFlags::OVERWRITE),
    ) {
        let _cleanup_result = sftp.unlink(Path::new(&temporary_path));
        return Err(CommandError::new("IBMI_WORKSPACE_WRITE", error.to_string()));
    }
    Ok(())
}

fn ensure_parent_directories(
    sftp: &ssh2::Sftp,
    path: &str,
    error_code: &'static str,
) -> CommandResult<()> {
    let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    let mut current = String::new();
    for segment in segments.iter().take(segments.len().saturating_sub(1)) {
        if segment.is_empty() || *segment == "." {
            continue;
        }
        current.push('/');
        current.push_str(segment);
        match sftp.stat(Path::new(&current)) {
            Ok(_) => {}
            Err(error) if error.code() == ErrorCode::SFTP(SFTP_NO_SUCH_FILE) => sftp
                .mkdir(Path::new(&current), 0o700)
                .map_err(|mkdir_error| CommandError::new(error_code, mkdir_error.to_string()))?,
            Err(error) => {
                return Err(CommandError::new(error_code, error.to_string()));
            }
        }
    }
    Ok(())
}

fn validate_workspace_path(path: &str) -> CommandResult<()> {
    if !path.starts_with('/')
        || path.contains('\0')
        || path.contains('\\')
        || path.split('/').any(|segment| segment == "..")
        || !path.to_lowercase().ends_with(".itworkspace")
    {
        return Err(CommandError::new(
            "IBMI_WORKSPACE_PATH",
            "Workspace paths must be safe absolute IFS paths ending in .itworkspace.",
        ));
    }
    Ok(())
}

fn ensure_workspace_size(size: usize) -> CommandResult<()> {
    if size > MAX_WORKSPACE_BYTES {
        return Err(CommandError::new(
            "IBMI_WORKSPACE_TOO_LARGE",
            "Workspace manifests cannot exceed 4 MiB.",
        ));
    }
    Ok(())
}

fn revision(bytes: &[u8]) -> String {
    let mut value = String::from("sha256:");
    for byte in Sha256::digest(bytes) {
        write!(&mut value, "{byte:02x}").expect("writing a digest to String cannot fail");
    }
    value
}

#[cfg(test)]
mod tests {
    use super::{
        parse_source_member_catalog, qsys_entry_name, revision, source_ccsid, system_name,
        validate_workspace_path,
    };

    #[test]
    fn workspace_revision_is_content_addressed() {
        assert_eq!(
            revision(b"workspace"),
            "sha256:21a3230e03772a58aff1b3709a9e232850916337e1fba95c434076b6668c6e08"
        );
    }

    #[test]
    fn workspace_paths_stay_inside_absolute_ifs_names() {
        assert!(validate_workspace_path("/home/DEV/orders.itworkspace").is_ok());
        assert!(validate_workspace_path("../orders.itworkspace").is_err());
        assert!(validate_workspace_path("/home/DEV/../orders.itworkspace").is_err());
    }

    #[test]
    fn qsys_catalog_names_reject_path_injection() {
        assert_eq!(system_name("bencz1", "library").unwrap(), "BENCZ1");
        assert!(system_name("../QSYS", "library").is_err());
        assert_eq!(
            qsys_entry_name("QRPGLESRC.FILE"),
            Some(("QRPGLESRC".to_owned(), "FILE".to_owned()))
        );
        assert_eq!(source_ccsid("*file").unwrap(), "*FILE");
        assert_eq!(source_ccsid("37").unwrap(), "37");
        assert!(source_ccsid("37) ENDLINFMT(*NONE").is_err());
        assert!(source_ccsid("65535").is_err());
    }

    #[test]
    fn source_member_catalog_preserves_ibmi_source_types() {
        let entries = parse_source_member_catalog(
            b"   CHECKBOX       25322 DSPF   08/24/26 08/24/26 12:00:00 43\n\
              ORDERS         40960 RPGLE  08/24/26 08/24/26 12:01:00 80\n",
        )
        .unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "CHECKBOX");
        assert_eq!(entries[0].source_type, "DSPF");
        assert_eq!(entries[1].source_type, "RPGLE");
    }
}
