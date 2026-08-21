import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Page-level error boundary: prevents a crash from blanking the whole app. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-medium">Something went wrong</div>
          <div className="mt-1 font-mono text-xs text-red-600">
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded border border-red-300 bg-white px-3 py-1 text-xs font-medium hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}