# ADR 0013: ILE projects model IBM i libraries and objects explicitly

## Status

Accepted.

## Context

An IBM i development project is not an ordinary IFS directory. Its primary
development resources are libraries, source physical files, source members,
programs, service programs, commands, files, modules, binding directories, and
other native objects. Treating those resources as generic folders would leak a
transport representation into the workbench and make compilation, diagnostics,
member metadata, and object actions difficult to model correctly.

IFS remains important for portable workspace manifests, Git checkouts, stream
files, generated artifacts, and offline synchronization. It is not the domain
model for ILE development.

## Decision

An IBM i workspace project identifies one library with the canonical URI
`ibmi://<connection-profile-id>/<library-system-name>`. The project stores only
the non-secret connection profile ID and the library system name. A workspace
may contain any number of these projects for the same connection profile, so
the developer can keep application, shared, dependency, and system libraries
visible simultaneously without merging their object namespaces.

The attach-libraries flow accepts several system names in one operation,
deduplicates them, ignores roots already present for that profile, and creates
one project per library. The active profile's default library and library list
are UI suggestions; they do not silently change a workspace.

The `ibmi-objects` feature owns validated models for library objects and source
members. `IbmiObjectBrowserService` requires an established session matching
the project profile. A session-scoped platform port exposes focused operations
to list:

- objects in a library;
- members in a source physical file.

The first desktop adapter reads library objects through the native `QSYS.LIB`
namespace over SFTP. Source-member catalogs run the native `DSPFD`
`TYPE(*MBRLIST) OUTPUT(*PRINT)` command through the IBM i `system` utility.
`system` writes spool output to stdout, and the adapter extracts each member's
authoritative source type, such as `DSPF`, `PF`, `LF`, `RPGLE`, or `CLLE`.
This avoids a dependency on the optional QShell `db2` utility. Editor selection
uses that metadata as the member extension; it never guesses a language by
inspecting source content. System names are validated independently in
JavaScript and Rust before entering a path or command. The workbench never
treats transport paths as portable project identifiers.

Direct SFTP reads of `.MBR` resources are deliberately prohibited: source
physical file records are exposed in their database encoding and record layout,
which is not editor text. Read-only member opening runs `CPYTOSTMF` on IBM i
with automatic database CCSID conversion, UTF-8 CCSID 1208, and LF line endings.
The database side defaults to `DBFCCSID(*FILE)`. A connection profile may carry
a validated numeric override for legacy source files whose stored bytes do not
match their file CCSID; assuming CCSID 37 globally or repairing characters in
the editor would corrupt correctly described international source files.
The converted stream file is staged under the connected user's private
`.ironterm/staging` directory, read through SFTP, revision-hashed, and removed
before the command returns.

Catalog reads share the connection's serialized SFTP subsystem. Member
conversion temporarily closes that subsystem before opening the SSH exec
channel and recreates it for the staged read. This prevents channel exhaustion
on IBM i SSH servers that reject multiple simultaneous subsystem channels.

`IbmiObjectCatalog` owns session-scoped catalog state and invalidates it when
the connection changes. The Project Explorer renders the catalog but does not
own or fetch remote state itself. Source physical files are expandable
containers; their member nodes display `SOURCE_TYPE`. Programs and other
objects remain typed leaf entries. The member controller routes `DSPF` and
`MNUDDS` to the visual DSPF designer and routes other types through the
language registry to the generic source editor.

Opening is idempotent by IBM i resource URI. Selecting an already open member
activates its existing workbench document and performs no second remote read.
Different DSPF resources create independent designer sessions and therefore
remain visible as separate tabs.

## Consequences

- ILE navigation is the primary remote development path; IFS workspace storage
  remains a separate capability.
- Multiple library roots share the established profile session and retain
  independent catalog and expand/collapse state in the Project Explorer.
- Source-member type metadata comes from a native IBM i command without
  coupling the workbench model to the `DSPFD` transport used by the desktop
  adapter.
- Source members can be opened as read-only UTF-8 documents. Display-file DDS
  uses the visual designer; database/printer DDS uses the highlighted source
  editor. Writing is intentionally blocked until `CPYFRMSTMF`, record-length
  validation, source metadata, and optimistic revision checks are implemented
  together.
- Object attributes, descriptions, compile diagnostics, and object actions
  remain future focused contracts; the current catalog does not claim those
  behaviors.
- Qualified SQL names and long SQL identifiers require a later model. This
  first catalog deliberately accepts IBM i system names of at most ten
  characters for `QSYS.LIB` safety.

## References

- [IBM i DSPFD command](https://www.ibm.com/docs/en/i/7.4.0?topic=ssw_ibm_i_74%2Fcl%2Fdspfd.html)
- [IBM i QShell system utility](https://www.ibm.com/docs/en/ssw_ibm_i_76/pdf/rzahzpdf.pdf)
