/** Two-column frame for login and registration. */
import Icon from '../../components/Icon';

export default function AuthShell({ title, text, points, children }) {
  return (
    <div className="auth-shell">
      <div className="auth-art">
        <div>
          <span className="eyebrow" style={{ color: 'var(--amber)' }}>KejaLink</span>
          <h2>{title}</h2>
          <p>{text}</p>
          <ul>{points.map((p) => <li key={p}><Icon name="check" />{p}</li>)}</ul>
        </div>
        <p className="xsmall" style={{ opacity: 0.7 }}>Your password is stored as a one-way hash. Nobody at KejaLink can see it.</p>
      </div>
      <div className="auth-form">{children}</div>
    </div>
  );
}
