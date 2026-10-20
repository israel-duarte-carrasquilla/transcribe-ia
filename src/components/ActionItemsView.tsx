import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  User,
  Plus,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { ActionItem, Participant } from '../types/meeting';

interface ActionItemsViewProps {
  actionItems: ActionItem[];
  participants: Participant[];
  onToggleStatus: (id: string) => void;
  onAddTask: (task: Omit<ActionItem, 'id'>) => void;
  onExportTasksCSV: () => void;
}

export const ActionItemsView: React.FC<ActionItemsViewProps> = ({
  actionItems,
  participants,
  onToggleStatus,
  onAddTask,
  onExportTasksCSV,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<'Todas' | 'Alta' | 'Media' | 'Baja'>('Todas');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('Todos');
  const [isAdding, setIsAdding] = useState(false);

  // New task form
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState(participants[0]?.name || '');
  const [newTaskPriority, setNewTaskPriority] = useState<'Alta' | 'Media' | 'Baja'>('Alta');
  const [newTaskDeadline, setNewTaskDeadline] = useState('');

  const completedCount = actionItems.filter((item) => item.status === 'completada').length;

  const filteredItems = actionItems.filter((item) => {
    if (priorityFilter !== 'Todas' && item.priority !== priorityFilter) return false;
    if (assigneeFilter !== 'Todos' && item.assignee !== assigneeFilter) return false;
    return true;
  });

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    onAddTask({
      task: newTaskTitle.trim(),
      assignee: newTaskAssignee || 'Equipo',
      priority: newTaskPriority,
      deadline: newTaskDeadline.trim() || 'A definir',
      status: 'pendiente',
    });

    setNewTaskTitle('');
    setNewTaskDeadline('');
    setIsAdding(false);
  };

  const getPriorityBadge = (priority: 'Alta' | 'Media' | 'Baja') => {
    switch (priority) {
      case 'Alta':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Alta
          </span>
        );
      case 'Media':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Media
          </span>
        );
      case 'Baja':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Baja
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-amber-500 text-white flex items-center justify-center shadow-md">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-100">Tareas Pendientes y Compromisos</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {completedCount}/{actionItems.length} completadas
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Responsables y plazos extraídos directamente de los compromisos de la reunión
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onExportTasksCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Exportar tareas a CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir Tarea</span>
          </button>
        </div>
      </div>

      {/* Add Task Inline Form */}
      {isAdding && (
        <form onSubmit={handleCreateTask} className="mb-6 p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">Nueva Tarea</h4>
          <input
            type="text"
            required
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Descripción del compromiso o tarea a realizar..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Responsable</label>
              <select
                value={newTaskAssignee}
                onChange={(e) => setNewTaskAssignee(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
                <option value="Equipo General">Equipo General</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Prioridad</label>
              <select
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="Alta">Alta</option>
                <option value="Media">Media</option>
                <option value="Baja">Baja</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-slate-400 mb-1">Fecha Límite</label>
              <input
                type="text"
                value={newTaskDeadline}
                onChange={(e) => setNewTaskDeadline(e.target.value)}
                placeholder="Ej. Viernes 23 de octubre"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
            >
              Guardar Tarea
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-slate-400">
        <div className="flex items-center space-x-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Prioridad:</span>
          {(['Todas', 'Alta', 'Media', 'Baja'] as const).map((pri) => (
            <button
              key={pri}
              onClick={() => setPriorityFilter(pri)}
              className={`px-2 py-0.5 rounded-lg transition ${
                priorityFilter === pri
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pri}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1.5 ml-auto">
          <span>Responsable:</span>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-0.5"
          >
            <option value="Todos">Todos</option>
            {participants.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No hay tareas que coincidan con los filtros seleccionados.
          </div>
        ) : (
          filteredItems.map((item) => {
            const isCompleted = item.status === 'completada';

            return (
              <div
                key={item.id}
                onClick={() => onToggleStatus(item.id)}
                className={`flex items-start justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isCompleted
                    ? 'bg-slate-800/20 border-slate-800/60 opacity-60'
                    : 'bg-slate-800/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-start space-x-3 min-w-0 pr-4">
                  <button
                    type="button"
                    className="mt-0.5 text-slate-400 hover:text-blue-400 shrink-0"
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-500" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isCompleted ? 'line-through text-slate-400' : 'text-slate-200'
                      }`}
                    >
                      {item.task}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-400">
                      <div className="flex items-center space-x-1 text-slate-300">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-semibold">{item.assignee}</span>
                      </div>

                      <div className="flex items-center space-x-1 text-slate-400">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>Plazo: {item.deadline}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-2">
                  {getPriorityBadge(item.priority)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
