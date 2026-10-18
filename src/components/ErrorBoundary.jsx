import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui-crash]', error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    // Navigating away should clear the crash screen.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const ar = document.documentElement.lang !== 'en';
    return (
      <div className="grid min-h-[60vh] place-items-center p-6">
        <div className="surface max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
            <AlertTriangle className="size-6" />
          </div>
          <h2 className="mb-1 text-lg font-bold text-ink">{ar ? 'حدث خطأ غير متوقع' : 'Something went wrong'}</h2>
          <p className="mb-5 text-sm text-stone-500">
            {ar ? 'لم نتمكن من عرض هذه الصفحة. جرّب إعادة التحميل.' : 'We could not render this page. Try reloading.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <RefreshCw className="size-4" />
            {ar ? 'إعادة التحميل' : 'Reload'}
          </button>
        </div>
      </div>
    );
  }
}
