import { Component } from 'preact';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '1rem', color: 'var(--text-main)', background: 'var(--bg-panel)', borderRadius: '8px' }}>
          <h3>Something went wrong.</h3>
          <p>An unexpected error occurred in this component.</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
