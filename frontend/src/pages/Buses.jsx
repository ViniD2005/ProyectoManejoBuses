import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Buses() {
    const [buses, setBuses] = useState([]);
    const [tiposAsiento, setTiposAsiento] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    const [form, setForm] = useState({
        numero_disco: '',
        placa: '',
        marca_chasis: '',
        marca_carroceria: '',
        anio_fabricacion: '',
        pisos: 1,
        cantidad_asientos: '',
        tipo_asiento_id: 1
    });

    const cargarDatos = async () => {
        try {
            setLoading(true);
            const [resBuses, resTipos] = await Promise.all([
                api.get('/buses'),
                api.get('/tipos-asiento').catch(() => ({ data: [] }))
            ]);
            setBuses(resBuses.data);
            setTiposAsiento(resTipos.data);
        } catch (err) {
            setError('Error al cargar la información de buses.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMensajeExito('');
        try {
            await api.post('/buses', form);
            setMensajeExito(`Bus registrado con éxito con ${form.cantidad_asientos} asientos.`);
            setForm({
                numero_disco: '',
                placa: '',
                marca_chasis: '',
                marca_carroceria: '',
                anio_fabricacion: '',
                pisos: 1,
                cantidad_asientos: '',
                tipo_asiento_id: 1
            });
            cargarDatos();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar el bus.');
        }
    };

    const cambiarEstado = async (id, estadoActual) => {
        try {
            await api.patch(`/buses/${id}/estado`, { activo: !estadoActual });
            cargarDatos();
        } catch (err) {
            setError('Error al cambiar el estado del bus.');
        }
    };

    return (
        <div className="max-w-7xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Gestión de Buses</h1>

            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>}
            {mensajeExito && <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{mensajeExito}</div>}

            {/* Formulario de Registro */}
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md mb-8 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">N° Disco</label>
                    <input type="text" value={form.numero_disco} onChange={e => setForm({...form, numero_disco: e.target.value})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Placa</label>
                    <input type="text" value={form.placa} onChange={e => setForm({...form, placa: e.target.value})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Chasis</label>
                    <input type="text" value={form.marca_chasis} onChange={e => setForm({...form, marca_chasis: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Carrocería</label>
                    <input type="text" value={form.marca_carroceria} onChange={e => setForm({...form, marca_carroceria: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Año Fabricación</label>
                    <input type="number" value={form.anio_fabricacion} onChange={e => setForm({...form, anio_fabricacion: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Pisos</label>
                    <input type="number" min="1" max="2" value={form.pisos} onChange={e => setForm({...form, pisos: Number(e.target.value)})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Cantidad Asientos</label>
                    <input type="number" min="10" max="100" value={form.cantidad_asientos} onChange={e => setForm({...form, cantidad_asientos: e.target.value})} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2" />
                </div>
                <div className="flex items-end">
                    <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 font-medium">Registrar Bus</button>
                </div>
            </form>

            {/* Tabla de Buses */}
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disco</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Placa</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chasis / Carrocería</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pisos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asientos</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr><td colSpan="7" className="px-6 py-4 text-center">Cargando...</td></tr>
                        ) : buses.length === 0 ? (
                            <tr><td colSpan="7" className="px-6 py-4 text-center text-gray-500">No hay buses registrados.</td></tr>
                        ) : (
                            buses.map((bus) => (
                                <tr key={bus.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">{bus.numero_disco}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-semibold">{bus.placa}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{bus.marca_chasis} / {bus.marca_carroceria}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{bus.pisos}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">{bus.total_asientos}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${bus.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {bus.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={() => cambiarEstado(bus.id, bus.activo)} className="text-indigo-600 hover:text-indigo-900">
                                            {bus.activo ? 'Desactivar' : 'Activar'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}