// Pie de página con los datos de soporte y redes sociales de la configuración (CC-12)
function PieDePagina({ configuracion }) {
  const { nombre_app, soporte_email, soporte_telefono, facebook_url, instagram_url } = configuracion

  return (
    <footer className="pie">
      <span>© {new Date().getFullYear()} {nombre_app}</span>
      {(soporte_email || soporte_telefono) && (
        <span>
          Soporte:{' '}
          {soporte_email && <a href={`mailto:${soporte_email}`}>{soporte_email}</a>}
          {soporte_email && soporte_telefono && ' — '}
          {soporte_telefono}
        </span>
      )}
      {(facebook_url || instagram_url) && (
        <span>
          {facebook_url && <a href={facebook_url} target="_blank" rel="noreferrer">Facebook</a>}
          {facebook_url && instagram_url && ' — '}
          {instagram_url && <a href={instagram_url} target="_blank" rel="noreferrer">Instagram</a>}
        </span>
      )}
    </footer>
  )
}

export default PieDePagina
