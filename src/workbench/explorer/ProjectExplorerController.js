import { WorkbenchDocumentKind } from '../documents/WorkbenchDocument.js';
import { WorkspaceProjectKind } from '../workspace/Workspace.js';

export class ProjectExplorerController {
    #abortController = null;
    #disposeWorkspace = null;
    #disposeSources = null;
    #disposeDocuments = null;
    #collapsedNodes = new Set();

    constructor ({
        element,
        summaryElement,
        workspaceSession,
        sourceDocuments,
        workbenchDocuments,
        commands,
        logger = globalThis.console,
    }) {
        if (!element) throw new TypeError('ProjectExplorerController requires a tree element.');
        if (!workspaceSession) {
            throw new TypeError('ProjectExplorerController requires a workspace session.');
        }
        if (!sourceDocuments) {
            throw new TypeError('ProjectExplorerController requires source documents.');
        }
        if (!workbenchDocuments) {
            throw new TypeError('ProjectExplorerController requires workbench documents.');
        }
        if (!commands) throw new TypeError('ProjectExplorerController requires commands.');
        this.element = element;
        this.summaryElement = summaryElement;
        this.workspaceSession = workspaceSession;
        this.sourceDocuments = sourceDocuments;
        this.workbenchDocuments = workbenchDocuments;
        this.commands = commands;
        this.logger = logger;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.element.addEventListener('click', event => this.#handleTreeClick(event), {
            signal,
        });
        const toolbar = this.element.closest('.project-explorer')
            ?.querySelector('.project-explorer-toolbar');
        toolbar?.addEventListener('click', event => this.#handleCommandClick(event), {
            signal,
        });
        this.#disposeWorkspace = this.workspaceSession.onDidChange(() => this.render());
        this.#disposeSources = this.sourceDocuments.onDidChange(() => this.render());
        this.#disposeDocuments = this.workbenchDocuments.onDidChange(() => this.render());
        this.render();
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
        this.#disposeWorkspace?.();
        this.#disposeSources?.();
        this.#disposeDocuments?.();
        this.#disposeWorkspace = null;
        this.#disposeSources = null;
        this.#disposeDocuments = null;
    }

    render () {
        const workspace = this.workspaceSession.workspace;
        const root = this.#list();
        root.append(
            this.#workspaceNode(workspace),
            this.#openEditorsNode(),
            this.#projectsNode(workspace),
        );
        this.element.replaceChildren(root);
        const toolbarButtons = this.element.closest('.project-explorer')
            ?.querySelectorAll('.project-explorer-toolbar [data-command]') ?? [];
        for (const button of toolbarButtons) {
            button.disabled = !this.commands.canExecute(button.dataset.command);
        }
        if (this.summaryElement) {
            const projectCount = workspace.projects.length;
            const sourceCount = this.sourceDocuments.documents.length;
            const editorCount = this.workbenchDocuments.documents.length;
            this.summaryElement.textContent =
                `${projectCount} project${projectCount === 1 ? '' : 's'} · ` +
                `${sourceCount} source${sourceCount === 1 ? '' : 's'} · ` +
                `${editorCount} open`;
            this.summaryElement.title = this.workspaceSession.fileName ?? 'Unsaved workspace';
        }
    }

    #workspaceNode (workspace) {
        const item = this.#node();
        item.append(this.#row({
            icon: 'WS',
            label: `${this.workspaceSession.isDirty ? '* ' : ''}${workspace.name}`,
            labelClass: 'workspace-label',
            meta: this.workspaceSession.fileName ? 'saved' : 'local',
            title: this.workspaceSession.fileName ?? 'Unsaved workspace',
        }));
        return item;
    }

    #openEditorsNode () {
        const nodeId = 'open-editors';
        const expanded = this.#isExpanded(nodeId);
        const item = this.#node();
        item.append(this.#row({
            icon: 'ED',
            label: 'Open Editors',
            labelClass: 'project-label',
            meta: String(this.workbenchDocuments.documents.length),
            nodeId,
            expanded,
        }));
        const children = this.#list();
        if (!this.workbenchDocuments.documents.length) {
            children.append(this.#empty('No open editors'));
        } else {
            for (const document of this.workbenchDocuments.documents) {
                const child = this.#node();
                child.append(this.#row({
                    icon: document.kind === WorkbenchDocumentKind.SOURCE_CODE ? 'S' : 'D',
                    label: `${document.isDirty ? '* ' : ''}${document.title}`,
                    meta: this.#documentKindLabel(document.kind),
                    active: document.id === this.workbenchDocuments.activeDocumentId,
                    title: document.resourceUri ?? document.title,
                    data: { documentId: document.id },
                }));
                children.append(child);
            }
        }
        children.hidden = !expanded;
        item.append(children);
        return item;
    }

    #projectsNode (workspace) {
        const nodeId = 'projects';
        const expanded = this.#isExpanded(nodeId);
        const item = this.#node();
        item.append(this.#row({
            icon: 'PR',
            label: 'Projects',
            labelClass: 'project-label',
            meta: String(workspace.projects.length),
            nodeId,
            expanded,
        }));
        const projects = this.#list();
        if (!workspace.projects.length) projects.append(this.#empty('No projects'));
        for (const project of workspace.projects) {
            projects.append(this.#projectNode(project, workspace.activeProjectId));
        }
        const projectIds = new Set(workspace.projects.map(project => project.id));
        const unassigned = this.sourceDocuments.documents.filter(
            document => !document.projectId || !projectIds.has(document.projectId));
        if (unassigned.length) projects.append(this.#unassignedSourcesNode(unassigned));
        projects.hidden = !expanded;
        item.append(projects);
        return item;
    }

    #projectNode (project, activeProjectId) {
        const nodeId = `project:${project.id}`;
        const expanded = this.#isExpanded(nodeId);
        const item = this.#node();
        item.append(this.#row({
            icon: project.kind === WorkspaceProjectKind.IBMI ? 'i' : 'P',
            label: project.name,
            labelClass: 'project-label',
            meta: project.kind,
            active: project.id === activeProjectId,
            title: project.rootUri ?? project.connectionProfileId ?? project.kind,
            data: { projectId: project.id },
            nodeId,
            expanded,
        }));

        const sources = this.sourceDocuments.documents.filter(
            document => document.projectId === project.id);
        const children = this.#list();
        if (!sources.length) {
            children.append(this.#empty(project.kind === WorkspaceProjectKind.IBMI
                ? 'Remote sources available after connection'
                : 'Open a source file'));
        } else {
            for (const document of sources) children.append(this.#sourceNode(document));
        }
        children.hidden = !expanded;
        item.append(children);
        return item;
    }

    #unassignedSourcesNode (sources) {
        const nodeId = 'loose-sources';
        const expanded = this.#isExpanded(nodeId);
        const item = this.#node();
        item.append(this.#row({
            icon: 'FS',
            label: 'Loose Sources',
            labelClass: 'project-label',
            meta: String(sources.length),
            title: 'Open sources not associated with a project in this workspace',
            nodeId,
            expanded,
        }));
        const children = this.#list();
        for (const document of sources) children.append(this.#sourceNode(document));
        children.hidden = !expanded;
        item.append(children);
        return item;
    }

    #sourceNode (document) {
        const item = this.#node();
        item.append(this.#row({
            icon: 'S',
            label: `${document.isDirty ? '* ' : ''}${document.name}`,
            meta: document.sourceType || document.languageId,
            active: this.sourceDocuments.activeDocument?.id === document.id,
            title: document.resourceUri ?? document.name,
            data: { sourceDocumentId: document.id },
        }));
        return item;
    }

    #row ({
        icon,
        label,
        labelClass = '',
        meta = '',
        active = false,
        title = '',
        data = {},
        nodeId = null,
        expanded = false,
    }) {
        const row = this.element.ownerDocument.createElement('button');
        row.type = 'button';
        row.className = 'project-tree-row';
        row.classList.toggle('active', active);
        row.setAttribute('role', 'treeitem');
        row.setAttribute('aria-selected', String(active));
        row.title = title;
        for (const [key, value] of Object.entries(data)) row.dataset[key] = value;

        const expander = this.element.ownerDocument.createElement('span');
        expander.className = 'project-tree-expander';
        expander.setAttribute('aria-hidden', 'true');
        if (nodeId) {
            row.dataset.nodeId = nodeId;
            row.setAttribute('aria-expanded', String(expanded));
            expander.textContent = expanded ? '−' : '+';
        }

        const iconElement = this.element.ownerDocument.createElement('span');
        iconElement.className = 'project-tree-icon';
        iconElement.setAttribute('aria-hidden', 'true');
        iconElement.textContent = icon;

        const labelElement = this.element.ownerDocument.createElement('span');
        labelElement.className = `project-tree-label ${labelClass}`.trim();
        labelElement.textContent = label;
        row.append(expander, iconElement, labelElement);

        if (meta) {
            const metaElement = this.element.ownerDocument.createElement('span');
            metaElement.className = 'project-tree-meta';
            metaElement.textContent = meta;
            row.append(metaElement);
        }
        return row;
    }

    #list () {
        const list = this.element.ownerDocument.createElement('ul');
        list.className = 'project-tree-list';
        list.setAttribute('role', 'group');
        return list;
    }

    #node () {
        const item = this.element.ownerDocument.createElement('li');
        item.className = 'project-tree-node';
        item.setAttribute('role', 'none');
        return item;
    }

    #empty (message) {
        const item = this.#node();
        item.classList.add('project-tree-empty');
        item.textContent = message;
        return item;
    }

    #handleTreeClick (event) {
        const row = event.target.closest('.project-tree-row');
        if (!row) return;
        const expanderClicked = Boolean(event.target.closest('.project-tree-expander'));
        if (row.dataset.nodeId && (expanderClicked || !row.dataset.projectId)) {
            this.#toggleNode(row.dataset.nodeId);
            return;
        }
        if (row.dataset.sourceDocumentId) {
            this.sourceDocuments.activate(row.dataset.sourceDocumentId);
            return;
        }
        if (row.dataset.documentId) {
            this.workbenchDocuments.activate(row.dataset.documentId);
            return;
        }
        if (row.dataset.projectId) {
            this.workspaceSession.workspace.activateProject(row.dataset.projectId);
        }
    }

    #handleCommandClick (event) {
        const button = event.target.closest('[data-command]');
        if (!button) return;
        void this.commands.execute(button.dataset.command).catch(error => {
            this.logger.error(`[ironterm] explorer command ${button.dataset.command} failed:`, error);
        });
    }

    #documentKindLabel (kind) {
        return kind === WorkbenchDocumentKind.SOURCE_CODE
            ? 'source'
            : kind === WorkbenchDocumentKind.DSPF_DESIGNER ? 'DSPF' : kind;
    }

    #isExpanded (nodeId) {
        return !this.#collapsedNodes.has(nodeId);
    }

    #toggleNode (nodeId) {
        if (this.#collapsedNodes.has(nodeId)) this.#collapsedNodes.delete(nodeId);
        else this.#collapsedNodes.add(nodeId);
        this.render();
    }
}
