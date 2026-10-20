import React, { useState, useEffect } from 'react';

const Buses = () => {
  const [buses, setBuses] = useState([]);
  const [cooperativas, setCooperativas] = useState([]);
  const [formData, setFormData] = useState({
    id_cooperativa: '',
    numero_disco: '',
    placa: '',
    chasis: '',
    carroceria: '',
    capacidad_asientos: '',
    foto_url: ''
  });
  const [editandoId, setEditandoId] = useState(null);

  // Cargar datos al iniciar
  useEffect(() => {
    cargarBuses();
    cargarCooperativas();
  }, []);

  const cargarBuses = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/buses');
      const data = await response.json();
      setBuses(data);
    } catch (error) {
      console.error('Error al cargar buses:', error);
    }
  };

  const cargarCooperativas = async () => {
    try {
      const response = await fetch('http://localhost:4000/api/cooperativas');
      const data = await response.json();
      setCooperativas(data);
    } catch (error) {
      console.error('Error al cargar cooperativas:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const url = editandoId 
        ? `http://localhost:4000/api/buses/${editandoId}` 
        : 'http://localhost:4000/api/buses';
      
      const method = editandoId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setFormData({
          id_cooperativa: '',
          numero_disco: '',
          placa: '',
          chasis: '',
          carroceria: '',
          capacidad_asientos: '',
          foto_url: ''
        });
        setEditandoId(null);
        cargarBuses();
      }
    } catch (error) {
      console.error('Error al guardar el bus:', error);
    }
  };

  const handleEditar = (bus) => {
    setFormData(bus);
    setEditandoId(bus.id);
  };

  const handleCambiarEstado = async (id, estadoActual) => {
    try {
      await fetch(`http://localhost:4000/api/buses/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !estadoActual })
      });
      cargarBuses();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4">Gestión de Buses / Unidades</h2>

      {/* Formulario */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h4 className="card-title mb-3">{editandoId ? 'Editar Bus' : 'Registrar Nuevo Bus'}</h4>
          <form onSubmit={handleSubmit} className="row g-3">
            <div className="col-md-4">
              <label className="form-label">Cooperativa</label>
              <select 
                className="form-select"
                value={formData.id_cooperativa}
                onChange={(e) => setFormData({...formData, id_cooperativa: e.target.value})}
                required
              >
                <option value="">Seleccione una cooperativa...</option>
                {cooperativas.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Número de Disco</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.numero_disco}
                onChange={(e) => setFormData({...formData, numero_disco: e.target.value})}
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Placa</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.placa}
                onChange={(e) => setFormData({...formData, placa: e.target.value})}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Chasis</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.chasis}
                onChange={(e) => setFormData({...formData, chasis: e.target.value})}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Carrocería</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.carroceria}
                onChange={(e) => setFormData({...formData, carroceria: e.target.value})}
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">Capacidad de Asientos</label>
              <input 
                type="number" 
                className="form-control"
                value={formData.capacidad_asientos}
                onChange={(e) => setFormData({...formData, capacidad_asientos: e.target.value})}
                required
              />
            </div>

            <div className="col-md-3">
              <label className="form-label">URL de la Fotografía</label>
              <input 
                type="text" 
                className="form-control"
                value={formData.foto_url}
                onChange={(e) => setFormData({...formData, foto_url: e.target.value})}
              />
            </div>

            <div className="col-12 mt-3">
              <button type="submit" className="btn btn-primary me-2">
                {editandoId ? 'Actualizar Bus' : 'Guardar Bus'}
              </button>
              {editandoId && (
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditandoId(null);
                    setFormData({ id_cooperativa: '', numero_disco: '', placa: '', chasis: '', carroceria: '', capacidad_asientos: '', foto_url: '' });
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* Tabla de Listado */}
      <div className="card shadow-sm">
        <div className="card-body">
          <h4 className="card-title mb-3">Lista de Buses Registrados</h4>
          <div className="table-responsive">
            <table className="table table-striped align-middle">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cooperativa</th>
                  <th>Disco</th>
                  <th>Placa</th>
                  <th>Chasis / Carrocería</th>
                  <th>Asientos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {buses.map(bus => (
                  <tr key={bus.id}>
                    <td>{bus.id}</td>
                    <td>{bus.cooperativa_nombre}</td>
                    <td>{bus.numero_disco}</td>
                    <td><strong>{bus.placa}</strong></td>
                    <td>{bus.chasis} / {bus.carroceria}</td>
                    <td>{bus.capacidad_asientos}</td>
                    <td>
                      <span className={`badge bg-${bus.activa ? 'success' : 'danger'}`}>
                        {bus.activa ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-sm btn-warning me-2"
                        onClick={() => handleEditar(bus)}
                      >
                        Editar
                      </button>
                      <button 
                        className={`btn btn-sm btn-${bus.activa ? 'outline-danger' : 'outline-success'}`}
                        onClick={() => handleCambiarEstado(bus.id, bus.activa)}
                      >
                        {bus.activa ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {buses.length === 0 && (
                  <tr>
                    <td colSpan="8" className="text-center text-muted">No hay buses registrados aún.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Buses;