import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WOS ErrorBoundary]', error, info.componentStack)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen bg-nb-bg flex items-center justify-center p-6">
          <div className="bg-white border-4 border-nb-border shadow-nb-lg max-w-[500px] w-full">
            <div className="bg-nb-red border-b-4 border-nb-border px-8 py-6 flex flex-col items-center text-center">
              <div className="text-5xl mb-3">💥</div>
              <h2 className="text-2xl font-black">Something went wrong</h2>
            </div>
            <div className="p-8">
              <p className="text-sm text-nb-fg-muted mb-4">
                The application encountered an unexpected error. Please try again or refresh the page.
              </p>
              {this.state.error && (
                <div className="bg-nb-bg border-2 border-nb-border p-4 mb-6 overflow-auto max-h-32">
                  <pre className="text-xs font-mono text-nb-red whitespace-pre-wrap break-all">
                    {this.state.error.message}
                  </pre>
                </div>
              )}
              <button
                onClick={this.handleRetry}
                className="w-full py-3 font-extrabold text-sm uppercase tracking-wider bg-nb-yellow border-4 border-nb-border shadow-nb hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer"
              >
                🔄 Try Again
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
