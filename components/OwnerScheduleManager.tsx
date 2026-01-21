import React, { useState, useEffect, useRef } from 'react';
import { OwnerSchedule } from '../types';
import { useAppStore } from '../store.tsx';
import { supabase } from '../supabaseClient';
import { Plus, Edit, Trash2, Calendar, Clock, MapPin, FileText, Tag, X, List, LayoutGrid } from 'lucide-react';
import DataGrid, { GridColumn } from './DataGrid';
import ConfirmModal from './ConfirmModal';
import { format, parseISO } from 'date-fns';

const OwnerScheduleManager: React.FC = () => {
  const { ownerSchedules = [], loadOwnerSchedules, addOwnerSchedule, updateOwnerSchedule, deleteOwnerSchedule, currentUser } = useAppStore();
  const [loading, setLoading] = React.useState(true);
  const loadedRef = React.useRef(false);
  
  // 组件加载时获取日程数据
  React.useEffect(() => {
    const loadData = async () => {
      if (currentUser?.role === 'owner' && !loadedRef.current) {
        try {
          setLoading(true);
          loadedRef.current = true;
          await loadOwnerSchedules();
        } catch (err) {
          console.warn('Failed to load owner schedules:', err);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    loadData();
  }, [currentUser]);
  
  // 仅owner可见
  if (!currentUser || currentUser.role !== 'owner') {
    return (
      <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-bold mb-2">无访问权限</div>
          <div className="text-sm text-slate-600 mb-4">仅负责人可以访问和管理日程。</div>
        </div>
      </div>
    );
  }

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTypeInput, setNewTypeInput] = useState('');
  const [tempTypes, setTempTypes] = useState<string[]>([]); // 临时保存新添加的类型

  // 从现有数据中动态提取类型列表，并加入默认类型和临时类型
  const scheduleTypes = React.useMemo(() => {
    const defaultTypes = ['会议', '出差', '培训', '其他'];
    const existingTypes = Array.from(new Set(ownerSchedules.map(s => s.type).filter(Boolean)));
    // 合并默认类型、已有类型和临时类型，去重
    const allTypes = Array.from(new Set([...defaultTypes, ...existingTypes, ...tempTypes]));
    return allTypes.sort();
  }, [ownerSchedules, tempTypes]);

  const initialForm: OwnerSchedule = {
    id: '',
    user_id: '', // 保存时会用auth.uid()填充
    start_datetime: '',
    end_datetime: '',
    type: '',
    title: '',
    location: '',
    notes: ''
  };

  const [formData, setFormData] = useState<OwnerSchedule>(initialForm);

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    isDanger?: boolean;
  } | null>(null);

  const handleOpenModal = (schedule?: OwnerSchedule) => {
    if (schedule) {
      // 将数据库格式 (yyyy-MM-dd HH:mm:ss) 转为 datetime-local 格式 (yyyy-MM-ddTHH:mm)
      const startLocal = schedule.start_datetime.slice(0, 16).replace(' ', 'T');
      const endLocal = schedule.end_datetime.slice(0, 16).replace(' ', 'T');
      
      setFormData({
        ...schedule,
        start_datetime: startLocal,
        end_datetime: endLocal
      });
      setEditingId(schedule.id);
    } else {
      setFormData({ 
        ...initialForm, 
        id: crypto.randomUUID(),
        user_id: currentUser?.id || ''
      });
      setEditingId(null);
    }
    setIsModalOpen(true);
  };

  const performSave = async () => {
    // 验证必填字段
    if (!formData.start_datetime || !formData.end_datetime || !formData.type || !formData.title) {
      alert('请填写所有必填字段（起止时间、类型、事项）');
      return;
    }

    // 验证时间顺序
    if (new Date(formData.start_datetime) >= new Date(formData.end_datetime)) {
      alert('结束时间必须晚于开始时间');
      return;
    }

    // 获取当前用户的 auth.uid()
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('未找到登录用户，请重新登录');
      return;
    }

    // 将 datetime-local 格式 (yyyy-MM-ddTHH:mm) 转为数据库格式 (yyyy-MM-dd HH:mm:ss)
    const formatForDB = (dt: string) => dt.replace('T', ' ') + ':00';
    
    // 设置正确的 user_id 和格式化时间
    const scheduleToSave = { 
      ...formData, 
      user_id: user.id,
      start_datetime: formatForDB(formData.start_datetime),
      end_datetime: formatForDB(formData.end_datetime)
    };

    // 如果跨越多日，自动拆分为多条记录
    const start = parseISO(scheduleToSave.start_datetime);
    const end = parseISO(scheduleToSave.end_datetime);
    
    const startDate = format(start, 'yyyy-MM-dd');
    const endDate = format(end, 'yyyy-MM-dd');

    if (startDate !== endDate) {
      // 跨越多日，需要拆分
      setConfirmConfig({
        isOpen: true,
        title: '跨日日程',
        message: `此日程跨越多日（${startDate} 至 ${endDate}），系统将自动拆分为多条日程记录。是否继续？`,
        onConfirm: () => {
          splitAndSaveSchedule(scheduleToSave);
          setConfirmConfig(null);
          setIsModalOpen(false);
        }
      });
    } else {
      // 单日日程，直接保存
      editingId ? updateOwnerSchedule(scheduleToSave) : addOwnerSchedule(scheduleToSave);
      setIsModalOpen(false);
    }
  };

  const splitAndSaveSchedule = (schedule: OwnerSchedule) => {
    const start = parseISO(schedule.start_datetime);
    const end = parseISO(schedule.end_datetime);
    
    let currentDate = new Date(start);
    const endDate = new Date(end);
    
    while (currentDate <= endDate) {
      const dayStart = format(currentDate, 'yyyy-MM-dd') === format(start, 'yyyy-MM-dd')
        ? schedule.start_datetime
        : `${format(currentDate, 'yyyy-MM-dd')}T00:00:00`;
      
      const dayEnd = format(currentDate, 'yyyy-MM-dd') === format(end, 'yyyy-MM-dd')
        ? schedule.end_datetime
        : `${format(currentDate, 'yyyy-MM-dd')}T23:59:59`;

      const splitSchedule: OwnerSchedule = {
        ...schedule,
        id: crypto.randomUUID(),
        start_datetime: dayStart,
        end_datetime: dayEnd,
        title: `${schedule.title} (${format(parseISO(dayStart), 'MM-dd')})`
      };

      addOwnerSchedule(splitSchedule);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
  };

  const handleSave = () => {
    performSave();
  };

  const handleDelete = (id: string) => {
    const schedule = ownerSchedules.find(s => s.id === id);
    setConfirmConfig({
      isOpen: true,
      title: '确认删除',
      message: `确定要删除日程 "${schedule?.title}" 吗？此操作不可撤销。`,
      onConfirm: () => {
        deleteOwnerSchedule(id);
        setConfirmConfig(null);
      },
      isDanger: true
    });
  };

  const addNewType = () => {
    if (newTypeInput.trim()) {
      // 添加到临时类型列表，让它立即显示在下拉框中
      setTempTypes(prev => [...prev, newTypeInput.trim()]);
      setFormData({ ...formData, type: newTypeInput.trim() });
      setNewTypeInput('');
    }
  };

  // 数据表格列定义
  const columns: GridColumn[] = [
    { 
      field: 'start_datetime',
      header: '开始时间',
      type: 'text',
      editable: false,
      width: '180px'
    },
    { 
      field: 'end_datetime',
      header: '结束时间',
      type: 'text',
      editable: false,
      width: '180px'
    },
    { field: 'type', header: '类型', type: 'text', width: '100px' },
    { field: 'title', header: '事项', type: 'text' },
    { field: 'location', header: '地点', type: 'text', width: '150px' },
    { field: 'notes', header: '备注', type: 'text' }
  ];

  // 格式化显示的数据（不使用 parseISO 避免时区转换）
  const displayData = ownerSchedules.map(s => ({
    ...s,
    start_datetime: s.start_datetime.slice(0, 16).replace('T', ' '), // yyyy-MM-dd HH:mm
    end_datetime: s.end_datetime.slice(0, 16).replace('T', ' ')
  }));

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Calendar />
          负责人日程管理
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
              }`}
            >
              <List size={16} /> 列表
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500'
              }`}
            >
              <LayoutGrid size={16} /> 表格
            </button>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
          >
            <Plus size={18} /> 新增日程
          </button>
        </div>
      </div>

      {/* 列表视图 */}
      {viewMode === 'list' && (
        <div className="flex-1 overflow-auto space-y-3">
          {ownerSchedules.length === 0 ? (
            <div className="text-center py-12 text-slate-400">暂无日程，点击上方"新增日程"开始添加</div>
          ) : (
            ownerSchedules
              .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
              .map(schedule => (
                <div key={schedule.id} className="bg-slate-50 p-4 rounded-lg border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full">
                          {schedule.type}
                        </span>
                        <h3 className="text-lg font-bold text-slate-800">{schedule.title}</h3>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>{schedule.start_datetime.slice(0, 16).replace('T', ' ')}</span>
                          <span>至</span>
                          <span>{schedule.end_datetime.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        {schedule.location && (
                          <div className="flex items-center gap-1">
                            <MapPin size={14} />
                            <span>{schedule.location}</span>
                          </div>
                        )}
                      </div>
                      {schedule.notes && (
                        <div className="mt-2 text-sm text-slate-500 flex items-start gap-1">
                          <FileText size={14} className="mt-0.5" />
                          <span>{schedule.notes}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenModal(schedule)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(schedule.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* 表格视图 */}
      {viewMode === 'grid' && (
        <div className="flex-1 overflow-auto">
          {displayData.length === 0 ? (
            <div className="text-center py-12 text-slate-400">暂无日程数据</div>
          ) : (
            <table className="w-full border-collapse bg-white">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  {columns.map(col => (
                    <th key={col.field} className="p-3 border-b font-semibold text-slate-700 text-left" style={{ width: col.width }}>
                      {col.header}
                    </th>
                  ))}
                  <th className="p-3 border-b font-semibold text-slate-700 text-center w-32">操作</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((item, idx) => {
                  const original = ownerSchedules[idx];
                  return (
                    <tr key={original.id} className="hover:bg-slate-50">
                      {columns.map(col => (
                        <td key={col.field} className="p-3 border-b text-slate-600">
                          {(item as any)[col.field] || '-'}
                        </td>
                      ))}
                      <td className="p-3 border-b text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(original)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                            title="编辑"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(original.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="删除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 编辑对话框 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? '编辑日程' : '新增日程'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    开始时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full border p-2 rounded-lg"
                    value={formData.start_datetime || ''}
                    onChange={e => setFormData({ ...formData, start_datetime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    结束时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full border p-2 rounded-lg"
                    value={formData.end_datetime || ''}
                    onChange={e => setFormData({ ...formData, end_datetime: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  类型 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    className="flex-1 border p-2 rounded-lg"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                  >
                    <option value="">-- 选择类型 --</option>
                    {scheduleTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="或输入新类型"
                    className="flex-1 border p-2 rounded-lg"
                    value={newTypeInput}
                    onChange={e => setNewTypeInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && addNewType()}
                  />
                  <button
                    onClick={addNewType}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                  >
                    添加
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  事项 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border p-2 rounded-lg"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="请输入事项内容"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">地点</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded-lg"
                  value={formData.location || ''}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="请输入地点"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">备注</label>
                <textarea
                  className="w-full border p-2 rounded-lg"
                  rows={4}
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="请输入备注信息"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                {editingId ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmConfig && (
        <ConfirmModal
          isOpen={confirmConfig.isOpen}
          title={confirmConfig.title}
          message={confirmConfig.message}
          onConfirm={confirmConfig.onConfirm}
          onCancel={() => setConfirmConfig(null)}
          isDanger={confirmConfig.isDanger}
        />
      )}
    </div>
  );
};

export default OwnerScheduleManager;
