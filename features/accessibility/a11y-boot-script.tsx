/**
 * Inline script that applies a11y data-* attributes from the cookie before paint
 * to avoid a flash of the default theme after Senior Mode was enabled.
 */
export function A11yBootScript() {
  const code = `(function(){try{var m=document.cookie.match(/(?:^|; )persona-a11y=([^;]*)/);if(!m)return;var d=JSON.parse(decodeURIComponent(m[1]));var r=document.documentElement;if(d.s)r.setAttribute("data-a11y-senior","");if(d.lt||d.s)r.setAttribute("data-a11y-large-text","");if(d.hc||d.s)r.setAttribute("data-a11y-high-contrast","");if(d.rm)r.setAttribute("data-a11y-reduced-motion","");if(d.vr||d.s)r.setAttribute("data-a11y-voice","");if(d.l)r.setAttribute("data-a11y-locale",d.l);}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
