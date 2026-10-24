
import { useState } from 'react';

function Frecuencias() {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [nombreParada, setNombreParada] = useState('');
  const [minutos, setMinutos] = useState('');
  const [precio, setPrecio] = useState('');
  const [paradas, setParadas] = useState([]);

  function agregarParada(e) {
    e.preventDefault();

    if (!nombreParada.trim() || minutos === '' || precio === '') {
      alert('Completa el nombre de la parada, los minutos y el precio.');
      return;
    }

    if (Number(minutos) <= 0 || Number(precio) < 0) {
      alert('Los minutos deben ser mayores que cero y el precio no puede ser negativo.');
      return;
    }

    const nuevaParada = {
      id: Date.now(),
      nombre: nombreParada.trim(),
      minutos: Number(minutos),
      precio: Number(precio),
    };

    setParadas([...paradas, nuevaParada]);
    setNombreParada('');
    setMinutos('');
    setPrecio('');
  }

  function eliminarParada(id) {
    setParadas(paradas.filter((parada) => parada.id !== id));
  }

  return (
    <main className="container mt-4">
      <h1 className="mb-2">Gestión de frecuencias</h1>

      <p className="text-muted mb-4">
        Administración de frecuencias y recorridos de las cooperativas
        de transporte interprovincial.
      </p>

      <section className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h4 mb-3">Registrar frecuencia</h2>

          <form>
            <div className="mb-3">
              <label htmlFor="origen" className="form-label">
                Ciudad de origen
              </label>
              <input
                type="text"
                id="origen"
                className="form-control"
                placeholder="Ingrese la ciudad de origen"
                value={origen}
                onChange={(e) => setOrigen(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="destino" className="form-label">
                Ciudad de destino
              </label>
              <input
                type="text"
                id="destino"
                className="form-control"
                placeholder="Ingrese la ciudad de destino"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                required
              />
            </div>

            <h3 className="h5 mt-4">Paradas del recorrido</h3>

            <div className="row-parada mb-3">
              <div className="campo-parada">
                <label htmlFor="nombreParada" className="form-label">
                  Nombre de la parada
                </label>
                <input
                  type="text"
                  id="nombreParada"
                  className="form-control"
                  placeholder="Ej. Riobamba"
                  value={nombreParada}
                  onChange={(e) => setNombreParada(e.target.value)}
                />
              </div>

              <div className="campo-parada">
                <label htmlFor="minutos" className="form-label">
                  Minutos
                </label>
                <input
                  type="number"
                  id="minutos"
                  className="form-control"
                  min="1"
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                />
              </div>

              <div className="campo-parada">
                <label htmlFor="precio" className="form-label">
                  Precio acumulado ($)
                </label>
                <input
                  type="number"
                  id="precio"
                  className="form-control"
                  min="0"
                  step="0.01"
                  value={precio}
                  onChange={(e) => setPrecio(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary mb-3"
              onClick={agregarParada}
            >
              Agregar parada
            </button>

            <div className="table-responsive">
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Orden</th>
                    <th>Parada</th>
                    <th>Minutos</th>
                    <th>Precio acumulado ($)</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {paradas.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">
                        Todavía no hay paradas registradas.
                      </td>
                    </tr>
                  ) : (
                    paradas.map((parada, indice) => (
                      <tr key={parada.id}>
                        <td>{indice + 1}</td>
                        <td>{parada.nombre}</td>
                        <td>{parada.minutos}</td>
                        <td>{parada.precio.toFixed(2)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => eliminarParada(parada.id)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </form>
        </div>
      </section>

      <section className="card shadow-sm">
        <div className="card-body">
          <h2 className="h4 mb-3">Frecuencias registradas</h2>
          <p className="text-muted mb-0">
            Todavía no hay frecuencias registradas.
          </p>
        </div>
      </section>
    </main>
  );
}

export default Frecuencias;
