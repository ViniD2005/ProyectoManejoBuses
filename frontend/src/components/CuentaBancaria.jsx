import { useState } from 'react'
import './CuentaBancaria.css'

/*
  GC-43: datos de la cuenta de la cooperativa a la que el cliente transfiere o deposita.
  cuenta: { banco, tipo, numero, titular, identificacion }
*/
const TIPO = { ahorros: 'Ahorros', corriente: 'Corriente' }

export default function CuentaBancaria({ cuenta, total }) {
  const [copiado, setCopiado] = useState(false)
  if (!cuenta?.numero) {
    return <div className="alerta alerta--aviso">Esta cooperativa todavía no registra su cuenta bancaria. Comunícate con ella o compra en su ventanilla.</div>
  }
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(cuenta.numero)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch { /* el navegador no permite copiar: el número queda visible */ }
  }
  const filas = [
    ['Banco', cuenta.banco],
    ['Tipo de cuenta', TIPO[cuenta.tipo] || cuenta.tipo],
    ['Número', cuenta.numero],
    ['Titular', cuenta.titular],
    [cuenta.identificacion?.length === 13 ? 'RUC' : 'Cédula', cuenta.identificacion],
    ...(total !== undefined ? [['Valor a pagar', `$${Number(total).toFixed(2)}`]] : []),
  ]
  return (
    <div className="cuenta-coop">
      <dl>
        {filas.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>
              {v}
              {k === 'Número' && (
                <button type="button" className="cuenta-coop__copiar" onClick={copiar} aria-label="Copiar el número de cuenta">
                  {copiado ? '✓ Copiado' : 'Copiar'}
                </button>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="cuenta-coop__nota">El pago va directamente a la cooperativa que opera tu viaje; su oficinista valida el comprobante.</p>
    </div>
  )
}
