'use client';

import { Component, type ReactNode } from 'react';

type ResearchWorkspaceBoundaryV6Props = {
    readonly children: ReactNode;
    readonly workspace: string;
};

type ResearchWorkspaceBoundaryV6State = {
    readonly failed: boolean;
};

export class ResearchWorkspaceBoundaryV6 extends Component<
    ResearchWorkspaceBoundaryV6Props,
    ResearchWorkspaceBoundaryV6State
> {
    state: ResearchWorkspaceBoundaryV6State = { failed: false };

    static getDerivedStateFromError(): ResearchWorkspaceBoundaryV6State {
        return { failed: true };
    }

    componentDidUpdate(previousProps: ResearchWorkspaceBoundaryV6Props) {
        if (previousProps.workspace !== this.props.workspace && this.state.failed) {
            this.setState({ failed: false });
        }
    }

    render() {
        if (this.state.failed) {
            return (
                <section role="alert" className="flex min-h-72 flex-1 items-center justify-center px-6 text-center">
                    <div>
                        <h2 className="text-lg font-bold text-[var(--text-primary)]">Workspace unavailable</h2>
                        <p className="mt-2 text-sm text-[var(--text-muted)]">
                            This workspace could not be loaded. Your saved research was not changed.
                        </p>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="mt-4 min-h-10 rounded-md bg-emerald-600 px-4 text-sm font-bold text-white"
                        >
                            Retry
                        </button>
                    </div>
                </section>
            );
        }

        return this.props.children;
    }
}
