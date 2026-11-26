import { useEffect, useState } from 'react'
import api, { mensajeDeError } from '../services/api.js'
import { errorCedula } from '../utils/validaciones.js'

/*
  GC-43: formulario de la cuenta bancaria de una cooperativa.
  Lo usan la propia cooperativa (Datos y apariencia) y el administrador (Cooperativas).
    url:          endpoint PUT donde se guarda ('/cuentas-bancarias/mia' o '/cuentas-bancarias/:id')
    cuenta:       cuenta actual o null
    cooperativa:  { nombre, ruc } para proponer el titular
    alGuardar(r): respuesta del servidor
    alCancelar:   opcional (en el panel del admin)
*/
const LETRAS = 'A-Za-zÁÉÍÓÚáéíóúÑñÜü'
const TITULAR = new RegExp(`^[${LETRAS}0-9]+(?:[ .,&'\\-][${LETRAS}0-9]*)*\\.?$`)

function erroresCuenta(f, bancos) {
  const e = {}
  const numero = f.numero.replace(/[\s-]/g, '')
  if (!f.banco) e.banco = 'Elige el banco o la cooperativa de ahorro'
  else if (bancos.length && !bancos.includes(f.banco)) e.banco = 'Elige una entidad de la lista'
  if (!f.tipo) e.tipo = 'Elige si la cuenta es de ahorros o corriente'
  if (!numero) e.numero = 'Escribe el número de cuenta'
  else if (!/^\d+$/.test(numero)) e.numero = 'El número de cuenta solo puede contener dígitos'
  else if (numero.length < 6 || numero.length > 20) e.numero = 'El número de cuenta debe tener entre 6 y 20 dígitos'
  else if (/^(\d)\1+$/.test(numero)) e.numero = 'El número de cuenta no es válido'
  const titular = f.titular.trim().replace(/\s+/g, ' ')
  if (titular.length < 3 || titular.length > 100) e.titular = 'El titular debe tener entre 3 y 100 caracteres'
  else if (!TITULAR.test(titular)) e.titular = 'El titular contiene caracteres no permitidos'
  const id = f.identificacion.trim()
  if (!id) e.identificacion = 'Escribe la cédula o el RUC del titular'
  else if (!/^\d+$/.test(id)) e.identificacion = 'Solo números'
  else if (id.length === 10) { const c = errorCedula(id); if (c) e.identificacion = 'La cédula del titular no es válida' }
  else if (id.length === 13) { if (!id.endsWith('001')) e.identificacion = 'El RUC debe terminar en 001' }
  else e.identificacion = 'Debe tener 10 dígitos (cédula) o 13 (RUC)'
  return e
}

export default function FormCuentaBancaria({ url, cuenta, cooperativa, alGuardar, alCancelar }) {
  const inicial = () => ({
    banco: cuenta?.banco || '',
    tipo: cuenta?.tipo || '',
    numero: cuenta?.numero || '',
    titular: cuenta?.titular || cooperativa?.nombre || '',
    identificacion: cuenta?.identificacion || cooperativa?.ruc || '',
  })
  const [form, setForm] = useState(inicial)
  const [bancos, setBancos] = useState([])
  const [errores, setErrores] = useState({})
  const [mensaje, setMensaje] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  useEffect(() => { api.get('/cuentas-bancarias/bancos').then(({ data }) => setBancos(data.bancos)).catch(() => {}) }, [])

  const cambio = Boolean(cuenta?.numero) && form.numero.replace(/[\s-]/g, '') !== cuenta.numero
  const hayCambios = Object.entries(inicial()).some(([k, v]) => String(form[k]).trim() !== String(v))

  const cambiar = (e) => {
    let { name, value } = e.target
    if (name === 'numero') value = value.replace(/[^\d]/g, '').slice(0, 20)
    if (name === 'identificacion') value = value.replace(/\D/g, '').slice(0, 13)
    setForm({ ...form, [name]: value })
    setErrores({ ...errores, [name]: '' })
    setMensaje(null)
    setConfirmar(false)
  }

  const guardar = async (e) => {
    e.preventDefault()
    const encontrados = erroresCuenta(form, bancos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return setMensaje({ tipo: 'error', texto: 'Revisa los datos marcados.' })
    // Cambiar el número de la cuenta de cobro pide una confirmación adicional
    if (cambio && !confirmar) {
      setConfirmar(true)
      return setMensaje({ tipo: 'aviso', texto: `Vas a cambiar la cuenta donde los clientes pagan (terminada en ${cuenta.numero.slice(-4)}) por una terminada en ${form.numero.slice(-4)}. Revisa el número y pulsa «Confirmar cambio».` })
    }
    setGuardando(true)
    try {
      const { data } = await api.put(url, { ...form, titular: form.titular.trim().replace(/\s+/g, ' ') })
      setMensaje({ tipo: 'exito', texto: data.sin_cambios ? 'No hubo cambios en la cuenta.' : 'Cuenta bancaria guardada. Desde ahora los clientes la ven al pagar.' })
      setConfirmar(false)
      alGuardar?.(data)
    } catch (err) {
      setErrores(err.response?.data?.detalles || {})
      setMensaje({ tipo: 'error', texto: mensajeDeError(err) })
    } finally {
      setGuardando(false)
    }
  }

  const campoError = (n) => errores[n] && <span className="campo__error">{errores[n]}</span>

  return (
    <form onSubmit={guardar} noValidate>
      {mensaje && <div className={`alerta alerta--${mensaje.tipo}`} role={mensaje.tipo === 'error' ? 'alert' : 'status'}>{mensaje.texto}</div>}
      <div className="rejilla-2">
        <div className={`campo ${errores.banco ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="cuenta-banco">Banco o cooperativa de ahorro</label>
          <select id="cuenta-banco" name="banco" value={form.banco} onChange={cambiar}>
            <option value="">Elige la entidad</option>
            {bancos.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {campoError('banco')}
        </div>
        <div className={`campo ${errores.tipo ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="cuenta-tipo">Tipo de cuenta</label>
          <select id="cuenta-tipo" name="tipo" value={form.tipo} onChange={cambiar}>
            <option value="">Elige</option>
            <option value="ahorros">Ahorros</option>
            <option value="corriente">Corriente</option>
          </select>
          {campoError('tipo')}
        </div>
      </div>
      <div className={`campo ${errores.numero ? 'campo--error' : ''}`}>
        <label className="campo__etiqueta" htmlFor="cuenta-numero">Número de cuenta</label>
        <input id="cuenta-numero" name="numero" inputMode="numeric" autoComplete="off" placeholder="2201234567" value={form.numero} onChange={cambiar} />
        {campoError('numero') || <span className="campo__ayuda">Solo dígitos, entre 6 y 20.</span>}
      </div>
      <div className="rejilla-2">
        <div className={`campo ${errores.titular ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="cuenta-titular">Titular de la cuenta</label>
          <input id="cuenta-titular" name="titular" maxLength={100} value={form.titular} onChange={cambiar} />
          {campoError('titular') || <span className="campo__ayuda">Normalmente, la razón social de la cooperativa.</span>}
        </div>
        <div className={`campo ${errores.identificacion ? 'campo--error' : ''}`}>
          <label className="campo__etiqueta" htmlFor="cuenta-identificacion">RUC o cédula del titular</label>
          <input id="cuenta-identificacion" name="identificacion" inputMode="numeric" value={form.identificacion} onChange={cambiar} />
          {campoError('identificacion')}
        </div>
      </div>
      <div className="fila" style={{ justifyContent: 'flex-end' }}>
        {alCancelar && <button type="button" className="btn" onClick={alCancelar}>Cancelar</button>}
        {!alCancelar && hayCambios && <button type="button" className="btn" onClick={() => { setForm(inicial()); setErrores({}); setMensaje(null); setConfirmar(false) }}>Descartar</button>}
        <button className={`btn ${confirmar ? 'btn-danger' : 'btn-primary'}`} disabled={guardando || !hayCambios}>
          {guardando ? 'Guardando…' : confirmar ? 'Confirmar cambio' : cuenta?.numero ? 'Guardar cuenta' : 'Registrar cuenta'}
        </button>
      </div>
    </form>
  )
}
