import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-obsidian text-white p-8">
          <h1 className="text-xl font-bold text-crimson mb-4">แอปโหลดไม่สำเร็จ</h1>
          <p className="text-silver mb-4">{this.state.error.message}</p>
          <div className="rounded-lg bg-charcoal border border-graphite p-4 text-sm text-muted space-y-2">
            <p className="font-semibold text-silver">วิธีแก้:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>หยุด backend เก่า (Ctrl+C ใน terminal backend)</li>
              <li>
                รันใหม่:{" "}
                <code className="font-mono text-neon">
                  uvicorn app.main:app --host 127.0.0.1 --port 8003 --reload
                </code>
              </li>
              <li>Refresh หน้านี้ (F5)</li>
            </ol>
          </div>
          <button
            type="button"
            className="mt-6 rounded-lg bg-electric/20 border border-electric/40 px-4 py-2 text-sm"
            onClick={() => window.location.reload()}
          >
            ลองใหม่
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
