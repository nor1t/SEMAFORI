import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';

const Dashboard = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  
  const [items, setItems] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', status: 'active' });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  const fetchUserData = async () => {
    setLoadingData(true);
    try {
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      setMessage({ text: 'Gabim gjatë leximit të të dhënave', type: 'error' });
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (user) fetchUserData();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setMessage({ text: 'Titulli është i detyrueshëm', type: 'error' });
      return;
    }
    try {
      const { error } = await supabase.from('user_data').insert([{
        user_id: user.id,
        title: formData.title,
        description: formData.description,
        status: formData.status
      }]);
      if (error) throw error;
      setMessage({ text: '✨ Të dhënat u shtuan me sukses!', type: 'success' });
      setFormData({ title: '', description: '', status: 'active' });
      fetchUserData();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: 'Gabim gjatë shtimit', type: 'error' });
    }
  };

  const handleUpdate = async (id) => {
    if (!formData.title.trim()) return;
    try {
      const { error } = await supabase
        .from('user_data')
        .update({ title: formData.title, description: formData.description, status: formData.status, updated_at: new Date() })
        .eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setMessage({ text: '✏️ Të dhënat u përditësuan!', type: 'success' });
      setEditingId(null);
      setFormData({ title: '', description: '', status: 'active' });
      fetchUserData();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: 'Gabim gjatë përditësimit', type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('A jeni i sigurt që doni ta fshini?')) return;
    try {
      const { error } = await supabase.from('user_data').delete().eq('id', id).eq('user_id', user.id);
      if (error) throw error;
      setMessage({ text: '🗑️ Të dhënat u fshinë!', type: 'success' });
      fetchUserData();
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (error) {
      setMessage({ text: 'Gabim gjatë fshirjes', type: 'error' });
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setFormData({ title: item.title, description: item.description || '', status: item.status });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({ title: '', description: '', status: 'active' });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Funksion për të marrë ngjyrat sipas statusit
  const getStatusColor = (status) => {
    switch(status) {
      case 'active': return 'bg-gradient-to-r from-green-400 to-green-500';
      case 'pending': return 'bg-gradient-to-r from-yellow-400 to-yellow-500';
      case 'completed': return 'bg-gradient-to-r from-blue-400 to-blue-500';
      default: return 'bg-gradient-to-r from-gray-400 to-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navbar kreative */}
      <nav className="bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-700/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-xl">📋</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Creative Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-gray-700/60 px-4 py-2 rounded-full shadow-inner border border-gray-600">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                  {user?.user_metadata?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </div>
                <span className="text-sm font-medium text-gray-300">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </span>
              </div>
              <button
                onClick={handleLogout}
                disabled={loading}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold rounded-full shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Përmbajtja kryesore */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mesazhet me stil */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-2xl shadow-lg backdrop-blur-sm animate-bounceIn ${
            message.type === 'success' 
              ? 'bg-green-900/30 border-l-8 border-green-500 text-green-400' 
              : 'bg-red-900/30 border-l-8 border-red-500 text-red-400'
          }`}>
            <div className="flex items-center">
              <span className="text-2xl mr-3">{message.type === 'success' ? '🎉' : '⚠️'}</span>
              <p className="font-medium">{message.text}</p>
            </div>
          </div>
        )}

        {/* Forma kreative */}
        <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-6 mb-8 border border-gray-700/50 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-xl">{editingId ? '✏️' : '➕'}</span>
            </div>
            <h2 className="text-2xl font-bold ml-3 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {editingId ? 'Edit Item' : 'Create New Item'}
            </h2>
          </div>
          
          <form onSubmit={editingId ? () => handleUpdate(editingId) : handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">📌 Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border-2 border-gray-600 bg-gray-700/60 text-white placeholder-gray-400 focus:bg-gray-700 focus:border-indigo-500 transition-all outline-none"
                  placeholder="Shkruani titullin..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">🏷️ Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border-2 border-gray-600 bg-gray-700/60 text-white focus:bg-gray-700 focus:border-indigo-500 transition-all outline-none"
                >
                  <option value="active">🟢 Active</option>
                  <option value="pending">🟡 Pending</option>
                  <option value="completed">🔵 Completed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">📝 Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-2 rounded-xl border-2 border-gray-600 bg-gray-700/60 text-white placeholder-gray-400 focus:bg-gray-700 focus:border-indigo-500 transition-all outline-none"
                placeholder="Përshkruani detajet..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold rounded-full shadow-md hover:shadow-xl transition-all transform hover:scale-105"
              >
                {editingId ? '✏️ Update Item' : '✨ Create Item'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-6 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-bold rounded-full shadow-md hover:shadow-xl transition-all"
                >
                  ❌ Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista e kartelave kreative */}
        <div className="bg-gray-800/40 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-gray-700/50">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white text-xl">📦</span>
            </div>
            <h2 className="text-2xl font-bold ml-3 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              My Items ({items.length})
            </h2>
          </div>

          {loadingData ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
              <p className="mt-3 text-gray-400">Loading your magic...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-gray-700/30 rounded-2xl">
              <span className="text-6xl">✨</span>
              <p className="mt-3 text-gray-400 font-medium">No items yet. Create your first masterpiece above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:scale-105 transform border border-gray-700"
                >
                  <div className={`h-2 ${getStatusColor(item.status)}`}></div>
                  <div className="p-5">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-xl text-gray-100 mb-2 line-clamp-1">{item.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${item.status === 'active' ? 'bg-green-900/40 text-green-400' : item.status === 'pending' ? 'bg-yellow-900/40 text-yellow-400' : 'bg-blue-900/40 text-blue-400'}`}>
                        {item.status === 'active' ? '🟢 Active' : item.status === 'pending' ? '🟡 Pending' : '🔵 Completed'}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                      {item.description || '📄 No description provided'}
                    </p>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xs text-gray-500">
                        🗓️ {new Date(item.created_at).toLocaleDateString()}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditing(item)}
                          className="text-indigo-400 hover:text-indigo-300 transition text-sm font-semibold px-2 py-1 rounded-lg hover:bg-indigo-900/30"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-red-400 hover:text-red-300 transition text-sm font-semibold px-2 py-1 rounded-lg hover:bg-red-900/30"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Animacion shtesë për mesazhet */}
      <style jsx>{`
        @keyframes bounceIn {
          0% { transform: scale(0.9); opacity: 0; }
          70% { transform: scale(1.02); }
          100% { transform: scale(1); opacity: 1; }
        }
        .animate-bounceIn {
          animation: bounceIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default Dashboard;