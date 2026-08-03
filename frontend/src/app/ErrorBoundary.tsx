import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/** Pantalla de respaldo: si algo falla en el render, en vez de una pantalla en negro
 *  mostramos un mensaje claro con botón para recargar. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VERA OS render error:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="vera-fallback" data-testid="error-boundary">
        <div className="vera-fallback__card">
          <div className="vera-fallback__logo">VERA <span>OS</span></div>
          <h1 className="vera-fallback__title">Se produjo un problema al mostrar esta pantalla</h1>
          <p className="vera-fallback__text">
            No te preocupes, tus datos están a salvo. Recargá para volver a intentarlo.
            Si estás usando el traductor del navegador, desactivalo para este sitio.
          </p>
          <button type="button" className="vera-fallback__btn" data-testid="error-reload" onClick={this.handleReload}>
            Recargar
          </button>
        </div>
      </div>
    );
  }
}
