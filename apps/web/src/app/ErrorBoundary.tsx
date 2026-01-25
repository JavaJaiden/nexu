import type React from "react";
import { Component } from "react";

// NOTE: Once you get Clerk working you can remove this error boundary
export class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: React.ReactNode | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    const errorText = `${error instanceof Error ? error.message : String(error)}`;
    if (
      errorText.includes("@clerk/clerk-react") &&
      errorText.includes("ClerkProvider")
    ) {
      return { hasError: true, error: "clerk-error" };
    }
    return { hasError: true, error: errorText };
  }

  componentDidCatch() {}

  render() {
    if (this.state.error !== null) {
      return (
        <div className="bg-destructive/30 p-8 flex flex-col gap-4 container">
          <h1 className="text-xl font-bold">
            Caught an error while rendering:
          </h1>
          {this.state.error}
        </div>
      );
    }

    return this.props.children;
  }
}
