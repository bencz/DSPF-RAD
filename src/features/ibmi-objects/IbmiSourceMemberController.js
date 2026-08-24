import { SourceDocument } from '../source-code/model/SourceDocument.js';
import { IbmiProjectLocation } from './model/IbmiProjectLocation.js';
import { IbmiSourceTypeResolver } from './model/IbmiSourceTypeResolver.js';

export class IbmiSourceMemberController {
    #listeners = new Set();
    #pending = new Map();

    constructor ({
        browser,
        profiles,
        documents,
        dspfFiles,
        languageServices,
        flash,
        logger = globalThis.console,
    }) {
        if (!browser) throw new TypeError('IbmiSourceMemberController requires a browser service.');
        if (!profiles) throw new TypeError('IbmiSourceMemberController requires connection profiles.');
        if (!documents) throw new TypeError('IbmiSourceMemberController requires source documents.');
        if (!dspfFiles) throw new TypeError('IbmiSourceMemberController requires DSPF files.');
        if (!languageServices) {
            throw new TypeError('IbmiSourceMemberController requires language services.');
        }
        this.browser = browser;
        this.profiles = profiles;
        this.documents = documents;
        this.dspfFiles = dspfFiles;
        this.languageServices = languageServices;
        this.flash = flash;
        this.logger = logger;
    }

    async open ({ project, sourceFile, member, sourceType = '' }) {
        const location = IbmiProjectLocation.fromProject(project);
        const resourceUri = this.#resourceUri(location, sourceFile, member);
        const resolvedSourceType = String(sourceType ?? '').trim().toUpperCase() ||
            IbmiSourceTypeResolver.fromSourceFile(sourceFile);
        if (this.#usesDspfDesigner(resolvedSourceType) &&
            this.dspfFiles.activateResource(resourceUri)) return true;
        const openDocument = this.documents.documents.find(
            document => document.resourceUri === resourceUri);
        if (openDocument) {
            this.documents.activate(openDocument.id);
            return openDocument;
        }
        const pending = this.#pending.get(resourceUri);
        if (pending) {
            try {
                return await pending;
            } catch {
                return null;
            }
        }
        const operation = this.#load({
            project,
            location,
            sourceFile,
            member,
            resolvedSourceType,
            resourceUri,
        });
        this.#pending.set(resourceUri, operation);
        this.#emit(resourceUri, true);
        try {
            return await operation;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('[ironterm] IBM i source member open failed:', error);
            this.flash?.(`Could not open IBM i source member: ${message}`, 'error', 7000);
            return null;
        } finally {
            this.#pending.delete(resourceUri);
            this.#emit(resourceUri, false);
        }
    }

    isLoading ({ project, sourceFile, member }) {
        const location = IbmiProjectLocation.fromProject(project);
        return this.#pending.has(this.#resourceUri(location, sourceFile, member));
    }

    onDidChange (listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('IBM i source member listener must be a function.');
        }
        this.#listeners.add(listener);
        return () => this.#listeners.delete(listener);
    }

    async #load ({
        project,
        location,
        sourceFile,
        member,
        resolvedSourceType,
        resourceUri,
    }) {
        const sourceCcsid = this.#sourceCcsid(location.connectionProfileId);
        this.flash?.(`Loading ${location.library}/${sourceFile}(${member}) from IBM i` +
            `${sourceCcsid === '*FILE' ? '' : ` using source CCSID ${sourceCcsid}`}…`);
        const content = await this.browser.readSourceMember({
            ...location,
            sourceFile,
            member,
            sourceCcsid,
        });
        const fileName = `${content.member}.${resolvedSourceType || 'mbr'}`;
        if (this.#usesDspfDesigner(resolvedSourceType)) {
            return this.dspfFiles.openRemoteSource({
                text: content.text,
                sourceName: content.member,
                title: fileName,
                resourceUri,
            });
        }
        const language = this.languageServices.languages.resolve({
            sourceType: resolvedSourceType,
            fileName,
        });
        const document = new SourceDocument({
            id: `ibmi-${location.connectionProfileId}-${content.library}-` +
                `${content.sourceFile}-${content.member}`,
            name: fileName,
            languageId: language.id,
            sourceType: resolvedSourceType,
            text: content.text,
            resourceUri,
            projectId: project.id,
            readOnly: true,
            revision: content.revision,
        });
        this.documents.open(document);
        this.flash?.(`Opened ${content.library}/${content.sourceFile}(${content.member}) ` +
            'read-only.', 'ok');
        return document;
    }

    #emit (resourceUri, isLoading) {
        const event = Object.freeze({ resourceUri, isLoading, controller: this });
        for (const listener of this.#listeners) listener(event);
    }

    #resourceUri (location, sourceFile, member) {
        return `ibmi://${location.connectionProfileId}/${location.library}/` +
            `${encodeURIComponent(sourceFile)}/${encodeURIComponent(member)}`;
    }

    #sourceCcsid (connectionProfileId) {
        const profile = this.profiles.get(connectionProfileId);
        if (!profile) {
            throw new Error(`Unknown IBM i connection profile: ${connectionProfileId}`);
        }
        return profile.sourceCcsid;
    }

    #usesDspfDesigner (sourceType) {
        return sourceType === 'DSPF' || sourceType === 'MNUDDS';
    }
}
