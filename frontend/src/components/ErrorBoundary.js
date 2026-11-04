/**
 * ErrorBoundary: if a page crashes while rendering, show a friendly message
 * instead of a blank screen (React requires a class component for this).
 */
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="error-page">
        <div className="big">Oops</div>
        <h1>Something went wrong on this page</h1>
        <p className="muted">Your data is safe. Reload the page to try again.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}
