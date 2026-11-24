import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './ComboBuscador.css'

/*
  GC-13: lista desplegable con buscador.
  Sirve para listas largas como los 221 cantones del Ecuador:
  al escribir "banos" aparece "Tungurahua - Baños" (sin importar tildes ni mayúsculas).

  <ComboBuscador
    id="origen"
    opciones={[{ valor: 4, etiqueta: 'Tungurahua - Ambato' }]}
    valor={form.origen}
    alCambiar={(valor) => setForm({ ...form, origen: valor })}
    placeholder="Busca un cantón"
  />
*/

// Quita tildes y pasa a minúsculas para comparar
const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const MAXIMO_VISIBLE = 60

function ComboBuscador({
  id, opciones = [], valor, alCambiar, placeholder = 'Escribe para buscar…',
  deshabilitado = false, invalido = false, vacio = 'No hay coincidencias', ...resto
}) {
  const idLista = useId()
  const caja = useRef(null)
  const entrada = useRef(null)
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)

  const elegida = opciones.find((o) => String(o.valor) === String(valor))

  const filtradas = useMemo(() => {
    const buscado = normalizar(texto).trim()
    if (!buscado) return opciones
    const palabras = buscado.split(/\s+/)
    return opciones.filter((o) => {
      const etiqueta = normalizar(`${o.etiqueta} ${o.detalle || ''}`)
      return palabras.every((p) => etiqueta.includes(p))
    })
  }, [opciones, texto])

  // Cierra al hacer clic fuera
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  const abrir = () => {
    if (deshabilitado) return
    setTexto('')
    setActivo(0)
    setAbierto(true)
  }

  const elegir = (opcion) => {
    alCambiar(opcion ? opcion.valor : '')
    setAbierto(false)
    setTexto('')
    entrada.current?.blur()
  }

  const teclado = (e) => {
    if (!abierto && ['ArrowDown', 'Enter'].includes(e.key)) { e.preventDefault(); abrir(); return }
    if (!abierto) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo((a) => Math.min(a + 1, Math.min(filtradas.length, MAXIMO_VISIBLE) - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); if (filtradas[activo]) elegir(filtradas[activo]) }
    if (e.key === 'Escape') { e.preventDefault(); setAbierto(false) }
  }

  return (
    <div className={`combo ${invalido ? 'combo--error' : ''} ${deshabilitado ? 'combo--deshabilitado' : ''}`} ref={caja}>
      <div className="combo__campo">
        <svg className="combo__lupa" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          ref={entrada}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-invalid={invalido || undefined}
          autoComplete="off"
          disabled={deshabilitado}
          placeholder={elegida ? elegida.etiqueta : placeholder}
          value={abierto ? texto : (elegida?.etiqueta || '')}
          onFocus={abrir}
          onClick={() => { if (!abierto) abrir() }}
          onChange={(e) => { setTexto(e.target.value); setActivo(0); setAbierto(true) }}
          onKeyDown={teclado}
          {...resto}
        />
        {elegida && !deshabilitado && (
          <button type="button" className="combo__limpiar" aria-label="Quitar selección" onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(null)}>×</button>
        )}
        <svg className="combo__flecha" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {abierto && (
        <ul className="combo__lista" id={idLista} role="listbox">
          {filtradas.length === 0 && <li className="combo__vacio">{vacio}</li>}
          {filtradas.slice(0, MAXIMO_VISIBLE).map((o, i) => (
            <li
              key={o.valor}
              role="option"
              aria-selected={String(o.valor) === String(valor)}
              className={`combo__opcion ${i === activo ? 'combo__opcion--activa' : ''} ${String(o.valor) === String(valor) ? 'combo__opcion--elegida' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(o)}
            >
              <span>{o.etiqueta}</span>
              {o.detalle && <small>{o.detalle}</small>}
            </li>
          ))}
          {filtradas.length > MAXIMO_VISIBLE && (
            <li className="combo__vacio">Sigue escribiendo para ver más ({filtradas.length - MAXIMO_VISIBLE} más)</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default ComboBuscador
