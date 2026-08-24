import { IbmiLibraryObject, IbmiSourceMember } from './model/IbmiCatalogEntry.js';
import { IbmiSystemName } from './model/IbmiSystemName.js';
import { IbmiSourceMemberContent } from './model/IbmiSourceMemberContent.js';
import { IbmiSourceCcsid } from '../../platform/ibmi/IbmiSourceCcsid.js';

export class IbmiObjectBrowserService {
    constructor ({ connectionService, port }) {
        if (!connectionService) {
            throw new TypeError('IbmiObjectBrowserService requires a connection service.');
        }
        if (!port) throw new TypeError('IbmiObjectBrowserService requires a platform port.');
        this.connectionService = connectionService;
        this.port = port;
    }

    async listLibraryObjects ({ connectionProfileId, library }) {
        const session = this.#session(connectionProfileId);
        const normalizedLibrary = IbmiSystemName.normalize(library, 'library');
        const result = await this.port.listLibraryObjects({
            sessionId: session.id,
            library: normalizedLibrary,
        });
        if (result?.library !== normalizedLibrary || !Array.isArray(result?.objects)) {
            throw new Error('The IBM i library response is invalid.');
        }
        return Object.freeze(result.objects.map(entry => new IbmiLibraryObject(entry)));
    }

    async listSourceMembers ({ connectionProfileId, library, sourceFile }) {
        const session = this.#session(connectionProfileId);
        const normalizedLibrary = IbmiSystemName.normalize(library, 'library');
        const normalizedSourceFile = IbmiSystemName.normalize(sourceFile, 'source file');
        const result = await this.port.listSourceMembers({
            sessionId: session.id,
            library: normalizedLibrary,
            sourceFile: normalizedSourceFile,
        });
        if (result?.library !== normalizedLibrary ||
            result?.sourceFile !== normalizedSourceFile || !Array.isArray(result?.members)) {
            throw new Error('The IBM i source member response is invalid.');
        }
        return Object.freeze(result.members.map(entry => new IbmiSourceMember(entry)));
    }

    async readSourceMember ({
        connectionProfileId,
        library,
        sourceFile,
        member,
        sourceCcsid = '*FILE',
    }) {
        const session = this.#session(connectionProfileId);
        const request = {
            sessionId: session.id,
            library: IbmiSystemName.normalize(library, 'library'),
            sourceFile: IbmiSystemName.normalize(sourceFile, 'source file'),
            member: IbmiSystemName.normalize(member, 'source member'),
            sourceCcsid: IbmiSourceCcsid.normalize(sourceCcsid),
        };
        const result = new IbmiSourceMemberContent(
            await this.port.readSourceMember(request));
        if (result.library !== request.library || result.sourceFile !== request.sourceFile ||
            result.member !== request.member) {
            throw new Error('The IBM i source member response is invalid.');
        }
        return result;
    }

    #session (connectionProfileId) {
        if (!this.port.available) {
            throw new Error('IBM i object browsing is unavailable in this host.');
        }
        const session = this.connectionService.session;
        if (!this.connectionService.isConnected || !session) {
            throw new Error('Connect to IBM i before browsing ILE objects.');
        }
        if (session.profileId !== connectionProfileId) {
            throw new Error('The active IBM i session does not match this project profile.');
        }
        return session;
    }
}
