export class WorkspaceStatusController {
    constructor ({ element, session }) {
        if (!element) throw new TypeError('WorkspaceStatusController requires an element.');
        if (!session) throw new TypeError('WorkspaceStatusController requires a session.');
        this.element = element;
        this.session = session;
        this.dispose = null;
    }

    start () {
        this.render();
        this.dispose?.();
        this.dispose = this.session.onDidChange(() => this.render());
        return () => {
            this.dispose?.();
            this.dispose = null;
        };
    }

    render () {
        const { workspace, isDirty, fileName, location } = this.session;
        const active = workspace.activeProject;
        const storage = location?.isRemote
            ? `IBM i IFS (${location.path})`
            : fileName ? `Local file (${fileName})` : 'Local cache';
        this.element.textContent = `${isDirty ? '* ' : ''}${workspace.name}`;
        this.element.classList.toggle('dirty', isDirty);
        this.element.title = active
            ? `Workspace: ${workspace.name}\nStorage: ${storage}\nActive project: ${active.name} (${active.kind})`
            : `Workspace: ${workspace.name}\nStorage: ${storage}\nNo active project`;
    }
}
