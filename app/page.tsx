'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Clock, Upload, Plus, X, Search, ArrowRight, Check, AlertCircle, Trash2, Calendar, BarChart3, TrendingUp, TrendingDown, Eye, Settings, Move, MapPin, LayoutGrid, Edit2, Download, FileDown, RefreshCw, Ghost, UserPlus, Link2, LogOut, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Guest {
  id: number;
  name: string;
  notes: string;
  isGhost?: boolean;
  isManuallyAdded?: boolean;
}

// New group system
interface Group {
  id: number;
  name: string | null;
  leadGuestId: number;
  leadGuestName: string;
  leadIsGhost?: boolean;
  members: GroupMembership[];
}

interface GroupMembership {
  id: number;
  groupId?: number;
  guestId: number;
  guestName: string;
  isGhost?: boolean;
}

// Legacy interface - kept for backward compatibility during migration
interface LegacyGroupMember {
  id: number;
  mainGuestId: number;
  name: string;
}

interface Table {
  id: number;
  name: string;
  capacity: number;
  x: number;
  y: number;
}

interface Service {
  id: number;
  name: string;
  time: string;
  color: string;
  lightColor: string;
  textColor: string;
}

const DEFAULT_SERVICES: Service[] = [
  { id: 1, name: 'Service 1', time: '11:30 - 12:30', color: 'bg-slate-700', lightColor: 'bg-slate-100', textColor: 'text-slate-700' },
  { id: 2, name: 'Service 2', time: '12:45 - 13:45', color: 'bg-amber-600', lightColor: 'bg-amber-100', textColor: 'text-amber-700' },
  { id: 3, name: 'Service 3', time: '13:00 - 14:00', color: 'bg-teal-600', lightColor: 'bg-teal-100', textColor: 'text-teal-700' }
];

const DAYS = [
  { id: 'mon', name: 'Monday', short: 'Mon' },
  { id: 'tue', name: 'Tuesday', short: 'Tue' },
  { id: 'wed', name: 'Wednesday', short: 'Wed' },
  { id: 'thu', name: 'Thursday', short: 'Thu' },
  { id: 'fri', name: 'Friday', short: 'Fri' },
  { id: 'sat', name: 'Saturday', short: 'Sat' },
  { id: 'sun', name: 'Sunday', short: 'Sun' }
];

// Helper function to display group size
const getGroupSizeText = (size: number) => {
  return size === 1 ? 'Individual' : `Group of ${size}`;
};

function RoomMap({ 
  tables, 
  guests, 
  assignments, 
  selectedDay, 
  selectedService, 
  onTableClick, 
  isEditor, 
  onTableDrag, 
  hasArrived, 
  highlightForReassign, 
  isTableBlocked 
}: {
  tables: Table[];
  guests: Guest[];
  assignments: Record<string, number[]>;
  selectedDay: string;
  selectedService: number;
  onTableClick?: (table: Table) => void;
  isEditor?: boolean;
  onTableDrag?: (tableId: number, x: number, y: number) => void;
  hasArrived?: (guestId: number) => boolean;
  highlightForReassign?: number | null;
  isTableBlocked?: (tableId: number, serviceId: number) => boolean;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 800, height: 500 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    if (!isEditor) return;
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragOffset({
      x: e.clientX - rect.left - table.x,
      y: e.clientY - rect.top - table.y
    });
    setDragging(table.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !isEditor || !onTableDrag || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const tableSize = 80;
    const padding = 5;
    
    // Allow full range of movement within container with small padding
    const newX = Math.max(padding, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - tableSize - padding));
    const newY = Math.max(padding, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - tableSize - padding));
    onTableDrag(dragging, Math.round(newX), Math.round(newY));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent, table: Table) => {
    if (!isEditor) return;
    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragOffset({
      x: touch.clientX - rect.left - table.x,
      y: touch.clientY - rect.top - table.y
    });
    setDragging(table.id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging || !isEditor || !onTableDrag || !containerRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const tableSize = 80;
    const padding = 5;
    
    const newX = Math.max(padding, Math.min(touch.clientX - rect.left - dragOffset.x, rect.width - tableSize - padding));
    const newY = Math.max(padding, Math.min(touch.clientY - rect.top - dragOffset.y, rect.height - tableSize - padding));
    onTableDrag(dragging, Math.round(newX), Math.round(newY));
  };

  // Calculate safe table position within bounds
  const getTablePosition = (table: Table) => {
    const tableSize = 80;
    const padding = 5;
    const maxX = Math.max(containerSize.width - tableSize - padding, padding);
    const maxY = Math.max(containerSize.height - tableSize - padding, padding);
    
    return {
      x: Math.max(padding, Math.min(table.x, maxX)),
      y: Math.max(padding, Math.min(table.y, maxY))
    };
  };

  return (
    <div 
      ref={containerRef}
      className="relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl border-2 border-gray-300 overflow-hidden"
      style={{ width: '100%', height: isEditor ? '500px' : '400px' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      {tables.map(table => {
        const key = `${selectedDay}-${selectedService}-${table.id}`;
        const assignedGuestIds = assignments[key] || [];
        const uniqueGuestIds = [...new Set(assignedGuestIds)];
        const occupancy = uniqueGuestIds.length;
        const allArrived = uniqueGuestIds.length > 0 && uniqueGuestIds.every(id => hasArrived ? hasArrived(id) : false);
        const someArrived = uniqueGuestIds.some(id => hasArrived ? hasArrived(id) : false);
        const isEmpty = uniqueGuestIds.length === 0;
        const isSourceTable = highlightForReassign === table.id;
        const isValidTarget = highlightForReassign && highlightForReassign !== table.id;
        const isBlocked = isTableBlocked ? isTableBlocked(table.id, selectedService) : false;
        const isDraggingThis = dragging === table.id;
        const pos = getTablePosition(table);

        return (
          <div
            key={table.id}
            className={`absolute flex flex-col items-center justify-center rounded-xl shadow-lg transition-all select-none ${
              isEditor 
                ? 'cursor-grab active:cursor-grabbing hover:ring-4 hover:ring-red-400/50' 
                : 'cursor-pointer hover:scale-105 hover:shadow-xl'
            } ${
              isDraggingThis ? 'ring-4 ring-red-700 shadow-2xl z-20 scale-105' : 'z-10'
            } ${
              isSourceTable
                ? 'ring-4 ring-orange-500 opacity-50'
                : isValidTarget && !isBlocked
                ? 'ring-4 ring-orange-400 hover:ring-orange-500 animate-pulse'
                : ''
            } ${
              isBlocked
                ? 'bg-red-200 text-red-700 opacity-60'
                : isEmpty 
                ? 'bg-white text-gray-600 border-2 border-gray-300' 
                : allArrived 
                ? 'bg-green-500 text-white' 
                : someArrived 
                ? 'bg-yellow-400 text-gray-800' 
                : 'bg-red-700 text-white'
            }`}
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              width: '80px',
              height: '80px'
            }}
            onMouseDown={(e) => handleMouseDown(e, table)}
            onTouchStart={(e) => handleTouchStart(e, table)}
            onClick={() => !isEditor && !dragging && onTableClick && onTableClick(table)}
          >
            <div className="font-bold text-sm">{table.name}</div>
            <div className="text-xs opacity-90">{occupancy}/{table.capacity}</div>
            {!isEmpty && (
              <div className="text-xs mt-1 font-medium">
                {assignedGuestIds.filter(id => hasArrived ? hasArrived(id) : false).length}/{uniqueGuestIds.length} ✓
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg p-3 text-xs space-y-1.5 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-white border-2 border-gray-300" />
          <span className="text-gray-600">Empty</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-700" />
          <span className="text-gray-600">Assigned</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-yellow-400" />
          <span className="text-gray-600">Partial arrivals</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500" />
          <span className="text-gray-600">All arrived</span>
        </div>
        {isEditor && (
          <div className="flex items-center gap-2 pt-1 border-t">
            <Move size={14} className="text-gray-400" />
            <span className="text-gray-600">Drag to move</span>
          </div>
        )}
      </div>
    </div>
  );
}

function RoomEditor({ 
  tables, 
  onTableDrag, 
  onAddTable, 
  onRemoveTable, 
  onClose 
}: {
  tables: Table[];
  onTableDrag: (tableId: number, x: number, y: number) => void;
  onAddTable: (name: string, capacity: number) => void;
  onRemoveTable: (tableId: number) => void;
  onClose: () => void;
}) {
  const [newTableName, setNewTableName] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState(6);

  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    onAddTable(newTableName.trim(), newTableCapacity);
    setNewTableName('');
    setNewTableCapacity(6);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <LayoutGrid size={20} />
            Room Layout Editor
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Drag tables to position them. Click a table to remove it.
          </p>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Table name"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm"
            />
            <input
              type="number"
              placeholder="Capacity"
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(parseInt(e.target.value) || 6)}
              className="w-24 px-3 py-2 border rounded-lg text-sm"
              min="1"
            />
            <button
              onClick={handleAddTable}
              className="px-4 py-2 bg-red-700 text-white rounded-lg text-sm hover:bg-red-800"
            >
              Add Table
            </button>
          </div>

          <RoomMap
            tables={tables}
            guests={[]}
            assignments={{}}
            selectedDay="mon"
            selectedService={1}
            isEditor={true}
            onTableDrag={onTableDrag}
          />

          <div className="mt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Tables ({tables.length})</h4>
            <div className="flex flex-wrap gap-2">
              {tables.map(table => (
                <div key={table.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
                  <span>{table.name} ({table.capacity})</span>
                  <button
                    onClick={() => onRemoveTable(table.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-red-700 text-white rounded-lg hover:bg-red-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function WaiterView({ 
  guests, 
  tables, 
  assignments, 
  selectedDay, 
  selectedService, 
  toggleArrival, 
  hasArrived, 
  setSelectedService, 
  onReassignGuest, 
  onReassignMultiple,
  isTableBlocked,
  services,
  groups,
  getGroupsAsLead,
  getGroupsAsMember,
  hasDeparted,
  toggleDeparture,
  departedGuests
}: {
  guests: Guest[];
  tables: Table[];
  assignments: Record<string, number[]>;
  selectedDay: string;
  selectedService: number;
  toggleArrival: (guestId: number) => void;
  hasArrived: (guestId: number) => boolean;
  setSelectedService: (serviceId: number) => void;
  onReassignGuest: (guestId: number, fromTableId: number, toTableId: number, serviceId: number) => void;
  onReassignMultiple: (guestIds: number[], fromTableId: number, toTableId: number, serviceId: number) => void;
  isTableBlocked: (tableId: number, serviceId: number) => boolean;
  services: Service[];
  groups: Group[];
  getGroupsAsLead: (guestId: number) => Group[];
  getGroupsAsMember: (guestId: number) => Group[];
  hasDeparted: (guestId: number, serviceId: number) => boolean;
  toggleDeparture: (guestId: number, serviceId: number) => void;
  departedGuests: Record<string, Record<number, Set<number>>>;
}) {
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [relocatingGuest, setRelocatingGuest] = useState<{ guest: Guest; fromTableId: number } | null>(null);
  const [relocatingMultiple, setRelocatingMultiple] = useState<{ guests: Guest[]; fromTableId: number } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const currentService = services.find(s => s.id === selectedService) || services[0];
  const previousService = services.find(s => s.id === selectedService - 1);

  // Get guest's group info
  const getGuestGroupInfo = (guestId: number) => {
    const asLead = getGroupsAsLead(guestId);
    if (asLead.length > 0) return { group: asLead[0], isLead: true };
    const asMember = getGroupsAsMember(guestId);
    if (asMember.length > 0) return { group: asMember[0], isLead: false };
    return null;
  };

  // Calculate table status
  const getTableStatus = (table: Table) => {
    const key = `${selectedDay}-${selectedService}-${table.id}`;
    const guestIds = [...new Set(assignments[key] || [])];
    const tableGuests = guestIds.map(id => guests.find(g => g.id === id)).filter(Boolean) as Guest[];
    const arrivedCount = tableGuests.filter(g => hasArrived(g.id)).length;
    const departedCount = tableGuests.filter(g => hasDeparted(g.id, selectedService)).length;
    const isBlocked = isTableBlocked(table.id, selectedService);
    
    // Check if previous service guests have left
    let prevServiceDeparted = 0;
    let prevServiceTotal = 0;
    if (previousService) {
      const prevKey = `${selectedDay}-${previousService.id}-${table.id}`;
      const prevGuestIds = [...new Set(assignments[prevKey] || [])];
      prevServiceTotal = prevGuestIds.length;
      prevServiceDeparted = prevGuestIds.filter(id => hasDeparted(id, previousService.id)).length;
    }
    
    // Table availability status
    let availabilityStatus: 'free' | 'clearing' | 'occupied' = 'free';
    if (tableGuests.length > 0) {
      if (departedCount === tableGuests.length) {
        availabilityStatus = 'free';
      } else if (departedCount > 0) {
        availabilityStatus = 'clearing';
      } else {
        availabilityStatus = 'occupied';
      }
    } else if (previousService && prevServiceTotal > 0) {
      if (prevServiceDeparted === prevServiceTotal) {
        availabilityStatus = 'free';
      } else if (prevServiceDeparted > 0) {
        availabilityStatus = 'clearing';
      } else {
        availabilityStatus = 'occupied';
      }
    }
    
    return {
      table,
      guests: tableGuests,
      arrivedCount,
      departedCount,
      totalCount: tableGuests.length,
      isBlocked,
      availabilityStatus,
      prevServiceDeparted,
      prevServiceTotal
    };
  };

  const tableStatuses = tables.map(getTableStatus);
  const totalGuests = tableStatuses.reduce((sum, t) => sum + t.totalCount, 0);
  const totalArrived = tableStatuses.reduce((sum, t) => sum + t.arrivedCount, 0);
  const totalDeparted = tableStatuses.reduce((sum, t) => sum + t.departedCount, 0);

  // Handle table click in room map
  const handleTableClick = (table: Table) => {
    if (relocatingGuest) {
      if (relocatingGuest.fromTableId !== table.id) {
        onReassignGuest(relocatingGuest.guest.id, relocatingGuest.fromTableId, table.id, selectedService);
        setRelocatingGuest(null);
      }
    } else if (relocatingMultiple) {
      if (relocatingMultiple.fromTableId !== table.id && relocatingMultiple.guests.length > 0) {
        onReassignMultiple(
          relocatingMultiple.guests.map(g => g.id), 
          relocatingMultiple.fromTableId, 
          table.id, 
          selectedService
        );
        setRelocatingMultiple(null);
      }
    } else {
      setSelectedTable(table);
    }
  };

  // Filter guests by search
  const searchResults = searchTerm ? tableStatuses.flatMap(ts => 
    ts.guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .map(g => ({ guest: g, table: ts.table }))
  ) : [];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Service Selector */}
            <div className="flex gap-2">
              {services.map(service => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service.id)}
                  className={`px-5 py-2.5 rounded-full font-medium transition-all ${
                    selectedService === service.id
                      ? `${service.color} text-white shadow-lg`
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {service.name}
                </button>
              ))}
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{totalArrived}</div>
                <div className="text-xs text-gray-500">Arrived</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{totalDeparted}</div>
                <div className="text-xs text-gray-500">Left</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-400">{totalGuests - totalArrived}</div>
                <div className="text-xs text-gray-500">Waiting</div>
              </div>
            </div>

            {/* Search */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search guest..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-full text-sm focus:ring-2 focus:ring-red-700 focus:border-red-700"
              />
              {searchTerm && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border max-h-64 overflow-y-auto z-50">
                  {searchResults.map(({ guest, table }) => (
                    <button
                      key={guest.id}
                      onClick={() => {
                        setSelectedTable(table);
                        setSearchTerm('');
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <span className="font-medium">{guest.name}</span>
                      <span className="text-sm text-gray-500">{table.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Relocating Banner */}
      {relocatingGuest && (
        <div className="bg-orange-100 border-b-2 border-orange-300 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Move size={20} className="text-orange-600" />
              <span className="font-medium text-orange-800">
                Relocating: <strong>{relocatingGuest.guest.name}</strong>
              </span>
              <span className="text-orange-600">— Tap a table on the map</span>
            </div>
            <button
              onClick={() => setRelocatingGuest(null)}
              className="px-4 py-1.5 bg-orange-200 text-orange-800 rounded-lg font-medium hover:bg-orange-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Relocating Multiple Banner */}
      {relocatingMultiple && (
        <div className="bg-blue-100 border-b-2 border-blue-300 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-blue-600" />
              <span className="font-medium text-blue-800">
                Relocating: <strong>{relocatingMultiple.guests.length} guests</strong>
              </span>
              <span className="text-blue-600">— Tap a table on the map</span>
            </div>
            <button
              onClick={() => setRelocatingMultiple(null)}
              className="px-4 py-1.5 bg-blue-200 text-blue-800 rounded-lg font-medium hover:bg-blue-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Room Map - Takes 2 columns */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <LayoutGrid size={18} />
              Room Layout
            </h3>
            <div 
              ref={containerRef}
              className="relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200 overflow-hidden"
              style={{ height: '500px' }}
            >
              {/* Grid pattern */}
              <div className="absolute inset-0 opacity-20">
                <svg width="100%" height="100%">
                  <defs>
                    <pattern id="waiter-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#waiter-grid)" />
                </svg>
              </div>
              
              {tableStatuses.map(status => {
                const { table, arrivedCount, totalCount, isBlocked, availabilityStatus, departedCount } = status;
                const allArrived = totalCount > 0 && arrivedCount === totalCount;
                const someArrived = arrivedCount > 0 && arrivedCount < totalCount;
                const allLeft = totalCount > 0 && departedCount === totalCount;
                const isRelocateTarget = (relocatingGuest && relocatingGuest.fromTableId !== table.id) ||
                  (relocatingMultiple && relocatingMultiple.fromTableId !== table.id);
                const isRelocateSource = relocatingGuest?.fromTableId === table.id || 
                  relocatingMultiple?.fromTableId === table.id;
                const isMultiRelocate = !!relocatingMultiple;

                // Determine table color
                let bgColor = 'bg-white border-2 border-gray-300 text-gray-600'; // Empty
                if (isBlocked) {
                  bgColor = 'bg-red-200 text-red-700 border-2 border-red-300';
                } else if (totalCount > 0) {
                  if (allLeft) {
                    bgColor = 'bg-gray-300 text-gray-600 border-2 border-gray-400'; // All left
                  } else if (allArrived) {
                    bgColor = 'bg-green-500 text-white border-2 border-green-600';
                  } else if (someArrived) {
                    bgColor = 'bg-yellow-400 text-gray-800 border-2 border-yellow-500';
                  } else {
                    bgColor = 'bg-red-700 text-white border-2 border-red-800';
                  }
                }

                // Availability indicator
                let availabilityDot = null;
                if (availabilityStatus === 'clearing') {
                  availabilityDot = <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full border-2 border-white animate-pulse" />;
                } else if (availabilityStatus === 'free' && totalCount === 0) {
                  availabilityDot = <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white" />;
                }

                return (
                  <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    className={`absolute flex flex-col items-center justify-center rounded-xl shadow-lg cursor-pointer transition-all hover:scale-105 ${bgColor} ${
                      isRelocateTarget ? (isMultiRelocate ? 'ring-4 ring-blue-400 animate-pulse' : 'ring-4 ring-orange-400 animate-pulse') : ''
                    } ${isRelocateSource ? (isMultiRelocate ? 'ring-4 ring-blue-500 opacity-50' : 'ring-4 ring-orange-500 opacity-50') : ''}`}
                    style={{
                      left: `${Math.min(table.x, (containerRef.current?.clientWidth || 600) - 90)}px`,
                      top: `${Math.min(table.y, 410)}px`,
                      width: '85px',
                      height: '85px'
                    }}
                  >
                    {availabilityDot}
                    <div className="font-bold text-sm">{table.name}</div>
                    <div className="text-xs opacity-90">{totalCount}/{table.capacity}</div>
                    {totalCount > 0 && (
                      <div className="text-xs mt-0.5 font-medium">
                        {arrivedCount}✓ {departedCount > 0 && `${departedCount}↗`}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Legend */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-lg p-2.5 text-xs space-y-1 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-white border-2 border-gray-300" />
                  <span className="text-gray-600">Empty</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-red-700" />
                  <span className="text-gray-600">Waiting</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-yellow-400" />
                  <span className="text-gray-600">Partial</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span className="text-gray-600">All arrived</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-300" />
                  <span className="text-gray-600">All left</span>
                </div>
              </div>

              {/* Availability Legend */}
              <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur rounded-lg p-2.5 text-xs shadow-lg">
                <div className="font-medium text-gray-700 mb-1">Availability</div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                  <span className="text-gray-600">Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-orange-400" />
                  <span className="text-gray-600">Clearing</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats & Tables List */}
          <div className="space-y-4">
            {/* Service Progress */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <h3 className="font-semibold text-gray-900 mb-3">{currentService.name} Progress</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Arrivals</span>
                    <span className="font-medium">{totalArrived}/{totalGuests}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ width: totalGuests > 0 ? `${(totalArrived / totalGuests) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Departures</span>
                    <span className="font-medium">{totalDeparted}/{totalGuests}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-400 transition-all"
                      style={{ width: totalGuests > 0 ? `${(totalDeparted / totalGuests) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tables Quick List */}
            <div className="bg-white rounded-2xl shadow-sm p-4 max-h-[400px] overflow-y-auto">
              <h3 className="font-semibold text-gray-900 mb-3">Tables</h3>
              <div className="space-y-2">
                {tableStatuses
                  .filter(ts => ts.totalCount > 0)
                  .sort((a, b) => {
                    // Sort by: needs attention first (some arrived), then waiting, then all arrived
                    const scoreA = a.arrivedCount === 0 ? 0 : a.arrivedCount === a.totalCount ? 2 : 1;
                    const scoreB = b.arrivedCount === 0 ? 0 : b.arrivedCount === b.totalCount ? 2 : 1;
                    return scoreA - scoreB;
                  })
                  .map(status => (
                    <button
                      key={status.table.id}
                      onClick={() => setSelectedTable(status.table)}
                      className={`w-full p-3 rounded-xl text-left transition hover:shadow-md flex items-center justify-between ${
                        status.arrivedCount === status.totalCount
                          ? 'bg-green-50 border border-green-200'
                          : status.arrivedCount > 0
                          ? 'bg-yellow-50 border border-yellow-200'
                          : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div>
                        <div className="font-medium">{status.table.name}</div>
                        <div className="text-xs text-gray-500">{status.totalCount} guests</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${
                          status.arrivedCount === status.totalCount ? 'text-green-600' :
                          status.arrivedCount > 0 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {status.arrivedCount}/{status.totalCount}
                        </span>
                        <ChevronRight size={16} className="text-gray-400" />
                      </div>
                    </button>
                  ))}
                {tableStatuses.filter(ts => ts.totalCount > 0).length === 0 && (
                  <p className="text-center text-gray-500 py-6">No guests assigned</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Detail Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-lg max-h-[90vh] overflow-hidden">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xl">{selectedTable.name}</h3>
                <p className="text-sm text-gray-500">
                  {(() => {
                    const status = tableStatuses.find(ts => ts.table.id === selectedTable.id);
                    if (!status) return 'Empty';
                    return `${status.arrivedCount}/${status.totalCount} arrived, ${status.departedCount} left`;
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const key = `${selectedDay}-${selectedService}-${selectedTable.id}`;
                  const guestIds = [...new Set(assignments[key] || [])];
                  const tableGuests = guestIds.map(id => guests.find(g => g.id === id)).filter(Boolean) as Guest[];
                  if (tableGuests.length > 1) {
                    return (
                      <button
                        onClick={() => {
                          setRelocatingMultiple({ guests: tableGuests, fromTableId: selectedTable.id });
                          setSelectedTable(null);
                        }}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg font-medium flex items-center gap-1"
                      >
                        <Users size={14} />
                        Move All
                      </button>
                    );
                  }
                  return null;
                })()}
                <button onClick={() => setSelectedTable(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh]">
              {(() => {
                const key = `${selectedDay}-${selectedService}-${selectedTable.id}`;
                const guestIds = [...new Set(assignments[key] || [])];
                const tableGuests = guestIds.map(id => guests.find(g => g.id === id)).filter(Boolean) as Guest[];
                
                if (tableGuests.length === 0) {
                  return <p className="text-center text-gray-500 py-8">No guests assigned</p>;
                }
                
                return tableGuests.map(guest => {
                  const arrived = hasArrived(guest.id);
                  const departed = hasDeparted(guest.id, selectedService);
                  const groupInfo = getGuestGroupInfo(guest.id);
                  
                  return (
                    <div
                      key={guest.id}
                      className={`p-4 mb-3 rounded-xl transition ${
                        departed ? 'bg-gray-100 opacity-60' : arrived ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          {/* Arrival Button */}
                          <button
                            onClick={() => toggleArrival(guest.id)}
                            disabled={departed}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                              departed ? 'bg-gray-300 cursor-not-allowed' :
                              arrived ? 'bg-green-500 text-white active:scale-90' :
                              'border-3 border-gray-300 hover:border-green-400 active:scale-90'
                            }`}
                          >
                            {arrived && <Check size={28} />}
                          </button>
                          
                          <div>
                            <div className={`font-semibold text-lg ${departed ? 'text-gray-500 line-through' : arrived ? 'text-green-700' : 'text-gray-900'}`}>
                              {guest.name}
                            </div>
                            {groupInfo && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Users size={12} />
                                {groupInfo.isLead ? 'Group lead' : `In ${groupInfo.group.leadGuestName}'s group`}
                              </div>
                            )}
                            {guest.notes && (
                              <div className="text-sm text-gray-500 mt-0.5">{guest.notes}</div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {/* Departure Button */}
                          {arrived && !departed && (
                            <button
                              onClick={() => toggleDeparture(guest.id, selectedService)}
                              className="p-2.5 text-orange-500 hover:bg-orange-50 rounded-xl transition"
                              title="Mark as left"
                            >
                              <LogOut size={22} />
                            </button>
                          )}
                          {departed && (
                            <button
                              onClick={() => toggleDeparture(guest.id, selectedService)}
                              className="px-3 py-1.5 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300"
                            >
                              Undo left
                            </button>
                          )}
                          
                          {/* Relocate Button */}
                          {!departed && (
                            <button
                              onClick={() => {
                                setRelocatingGuest({ guest, fromTableId: selectedTable.id });
                                setSelectedTable(null);
                              }}
                              className="p-2.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition"
                              title="Relocate to another table"
                            >
                              <Move size={22} />
                            </button>
                          )}
                          
                          {guest.isManuallyAdded && (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-600 rounded-full">
                              + Added
                            </span>
                          )}
                          {guest.isGhost && (
                            <span className="text-xs px-2 py-1 bg-purple-100 text-purple-600 rounded-full">
                              Ghost
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WeeklySummary({ 
  guests, 
  assignments, 
  arrivedGuests, 
  tables,
  services,
  onExportDay,
  onExportWeek
}: {
  guests: Guest[];
  assignments: Record<string, number[]>;
  arrivedGuests: Record<string, Set<number>>;
  tables: Table[];
  services: Service[];
  onExportDay: (dayId: string) => void;
  onExportWeek: () => void;
}) {
  const dailyStats = DAYS.map(day => {
    const dayAssignments = Object.keys(assignments)
      .filter(k => k.startsWith(`${day.id}-`))
      .flatMap(k => assignments[k]);
    
    const uniqueGuests = [...new Set(dayAssignments)];
    // Exclude ghosts from counts
    const nonGhostGuests = uniqueGuests.filter(id => {
      const guest = guests.find(g => g.id === id);
      return guest && !guest.isGhost;
    });
    const totalSeats = nonGhostGuests.length; // Each non-ghost guest = 1 seat
    
    const dayArrivals = arrivedGuests[day.id] || new Set();
    const arrived = nonGhostGuests.filter(id => dayArrivals.has(id)).length;
    
    const serviceBreakdown = services.map(service => {
      const serviceAssignments = Object.keys(assignments)
        .filter(k => k.startsWith(`${day.id}-${service.id}-`))
        .flatMap(k => assignments[k]);
      const nonGhostServiceGuests = serviceAssignments.filter(id => {
        const guest = guests.find(g => g.id === id);
        return guest && !guest.isGhost;
      });
      return {
        service,
        guests: nonGhostServiceGuests.length,
        arrived: nonGhostServiceGuests.filter(id => dayArrivals.has(id)).length
      };
    });
    
    return {
      day,
      totalGuests: nonGhostGuests.length,
      totalSeats,
      arrived,
      arrivalRate: nonGhostGuests.length > 0 ? Math.round((arrived / nonGhostGuests.length) * 100) : 0,
      serviceBreakdown
    };
  });

  const totalWeekGuests = dailyStats.reduce((sum, d) => sum + d.totalGuests, 0);
  const totalWeekArrivals = dailyStats.reduce((sum, d) => sum + d.arrived, 0);
  const avgDailyGuests = totalWeekGuests / 7;
  const peakDay = dailyStats.reduce((max, d) => d.totalGuests > max.totalGuests ? d : max, dailyStats[0]);
  const lowestDay = dailyStats.reduce((min, d) => d.totalGuests < min.totalGuests ? d : min, dailyStats[0]);
  
  const servicePopularity = services.map(service => {
    const total = DAYS.reduce((sum, day) => {
      const serviceAssignments = Object.keys(assignments)
        .filter(k => k.startsWith(`${day.id}-${service.id}-`))
        .flatMap(k => assignments[k]);
      return sum + serviceAssignments.length;
    }, 0);
    return { service, total };
  }).sort((a, b) => b.total - a.total);

  const maxGuests = Math.max(...dailyStats.map(d => d.totalGuests), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-red-700">{totalWeekGuests}</div>
          <div className="text-sm text-gray-500">Total Guest Assignments</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-green-600">{totalWeekArrivals}</div>
          <div className="text-sm text-gray-500">Total Arrivals</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-blue-600">{avgDailyGuests.toFixed(1)}</div>
          <div className="text-sm text-gray-500">Avg Daily Guests</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <div className="text-3xl font-bold text-purple-600">
            {totalWeekGuests > 0 ? Math.round((totalWeekArrivals / totalWeekGuests) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-500">Overall Arrival Rate</div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 size={20} />
          Daily Attendance
        </h3>
        <div className="space-y-3">
          {dailyStats.map(({ day, totalGuests, arrived, arrivalRate }) => (
            <div key={day.id} className="flex items-center gap-4">
              <div className="w-20 text-sm font-medium text-gray-700">{day.short}</div>
              <div className="flex-1">
                <div className="h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-red-200 rounded-lg transition-all"
                    style={{ width: `${(totalGuests / maxGuests) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-green-500 rounded-lg transition-all"
                    style={{ width: `${(arrived / maxGuests) * 100}%` }}
                  />
                  {totalGuests > 0 && (
                    <div className="absolute inset-0 flex items-center px-3">
                      <span className="text-xs font-medium text-gray-700">
                        {arrived}/{totalGuests} guests ({arrivalRate}% arrived)
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onExportDay(day.id)}
                className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition flex-shrink-0"
                title={`Export ${day.name} report`}
              >
                <FileDown size={16} />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-200 rounded" />
            <span>Assigned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded" />
            <span>Arrived</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={20} />
            Peak & Low Days
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-green-700">Busiest Day</div>
                <div className="text-lg font-bold text-green-800">{peakDay.day.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">{peakDay.totalGuests}</div>
                <div className="text-xs text-green-600">guests</div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-orange-700">Quietest Day</div>
                <div className="text-lg font-bold text-orange-800">{lowestDay.day.name}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-orange-600">{lowestDay.totalGuests}</div>
                <div className="text-xs text-orange-600">guests</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Service Popularity</h3>
          <div className="space-y-3">
            {servicePopularity.map(({ service, total }, index) => (
              <div key={service.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg ${service.color} flex items-center justify-center text-white font-bold text-sm`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{service.name}</div>
                    <div className="text-xs text-gray-500">{service.time}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{total}</div>
                  <div className="text-xs text-gray-500">bookings</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingDown size={20} className="text-red-500" />
          No-Show Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dailyStats
            .filter(d => d.totalGuests > 0)
            .sort((a, b) => (b.totalGuests - b.arrived) - (a.totalGuests - a.arrived))
            .slice(0, 3)
            .map(({ day, totalGuests, arrived }) => {
              const noShows = totalGuests - arrived;
              return (
                <div key={day.id} className="p-3 bg-red-50 rounded-lg">
                  <div className="text-sm text-red-700">{day.name}</div>
                  <div className="text-xl font-bold text-red-600">{noShows} no-shows</div>
                  <div className="text-xs text-red-500">{totalGuests - arrived} of {totalGuests} didn&apos;t arrive</div>
                </div>
              );
            })}
          {dailyStats.filter(d => d.totalGuests > 0).length === 0 && (
            <div className="col-span-3 text-center text-gray-500 py-4">
              No assignments yet to analyze
            </div>
          )}
        </div>
      </div>

      {/* Overall Weekly Export Button */}
      <div className="flex justify-center">
        <button
          onClick={onExportWeek}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
        >
          <FileDown size={20} />
          <span className="font-medium">Export Full Weekly Report</span>
        </button>
      </div>
    </div>
  );
}

export default function SeatingManager() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [assignments, setAssignments] = useState<Record<string, number[]>>({});
  const [seatAllocations, setSeatAllocations] = useState<Record<string, Record<number, number>>>({});
  const [partySizeOverrides, setPartySizeOverrides] = useState<Record<string, number>>({});
  const [groupMembers, setGroupMembers] = useState<Record<number, LegacyGroupMember[]>>({});
  const [memberArrivals, setMemberArrivals] = useState<Record<string, Record<number, boolean>>>({});
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [selectedService, setSelectedService] = useState(1);
  const [selectedDay, setSelectedDay] = useState('mon');
  const [showWeekOverview, setShowWeekOverview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [guestFilter, setGuestFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [guestSort, setGuestSort] = useState<'name' | 'size'>('name');
  const [showOvercapacityAlert, setShowOvercapacityAlert] = useState(false);
  const [overcapacityTable, setOvercapacityTable] = useState<{table: Table, guests: Guest[], over: number} | null>(null);
  const [guestListCollapsed, setGuestListCollapsed] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expandedGuests, setExpandedGuests] = useState<Set<number>>(new Set());
  const [newMemberName, setNewMemberName] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [showTableForm, setShowTableForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [showServiceSettings, setShowServiceSettings] = useState(false);
  const [showEditGuest, setShowEditGuest] = useState(false);
  const [showSplitGroup, setShowSplitGroup] = useState(false);
  const [showChairManagement, setShowChairManagement] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [splittingGuest, setSplittingGuest] = useState<Guest | null>(null);
  const [chairTargetTable, setChairTargetTable] = useState<Table | null>(null);
  const [chairAdjustments, setChairAdjustments] = useState<Record<string, Record<number, number>>>({});
  const [tempChairAdjustments, setTempChairAdjustments] = useState<{tableId: number, chairs: number}[]>([]);
  const [splitAllocations, setSplitAllocations] = useState<{tableId: number, seats: number}[]>([]);
  const [newGuest, setNewGuest] = useState({ name: '', notes: '', assignedTable: null as number | null, assignedService: null as number | null });
  const [newTable, setNewTable] = useState({ name: '', capacity: 6 });
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [quickAssignMode, setQuickAssignMode] = useState(false);
  const [importText, setImportText] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: string } | null>(null);
  const [arrivedGuests, setArrivedGuests] = useState<Record<string, Set<number>>>({});
  const [departedGuests, setDepartedGuests] = useState<Record<string, Record<number, Set<number>>>>({});  // day -> serviceId -> Set of guestIds
  const [reassignGuest, setReassignGuest] = useState<{ guest: Guest; fromTableId: number; serviceId: number; moveWholeGroup?: boolean; groupId?: number } | null>(null);
  const [reassignGuests, setReassignGuests] = useState<{ guests: Guest[]; fromTableId: number; serviceId: number } | null>(null);
  const [viewMode, setViewMode] = useState('manager');
  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [blockedTables, setBlockedTables] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  
  // Groups tab state
  const [activeTab, setActiveTab] = useState<'guests' | 'groups'>('guests');
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [newGroupLeadSearch, setNewGroupLeadSearch] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [groupSearchTerm, setGroupSearchTerm] = useState('');
  
  // Group member assignment/move confirmation (for both new assignment and moving)
  const [groupMemberAction, setGroupMemberAction] = useState<{
    guest: Guest;
    tableId: number;
    groupId: number;
    leadGuestId: number;
    isMove: boolean; // true if moving, false if initial assignment
    fromTableId?: number;
  } | null>(null);
  
  // Multiple groups selection popup
  const [selectGroupForAssign, setSelectGroupForAssign] = useState<{
    guest: Guest;
    tableId: number;
    groups: Group[];
  } | null>(null);
  
  // Split group member assignments (guestId -> tableId mapping)
  const [splitMemberAssignments, setSplitMemberAssignments] = useState<Record<number, number | null>>({});

  const showNotification = (message: string, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Fetch all data from API
  const fetchData = useCallback(async () => {
    try {
      // Initialize database first
      await fetch('/api/init');
      
      const [guestsRes, tablesRes, assignmentsRes, arrivalsRes, blockedRes, membersRes, memberArrivalsRes, groupsRes] = await Promise.all([
        fetch('/api/guests'),
        fetch('/api/tables'),
        fetch('/api/assignments'),
        fetch('/api/arrivals'),
        fetch('/api/blocked-tables'),
        fetch('/api/group-members'),
        fetch('/api/member-arrivals'),
        fetch('/api/groups')
      ]);

      const guestsData = await guestsRes.json();
      const tablesData = await tablesRes.json();
      const assignmentsData = await assignmentsRes.json();
      const arrivalsData = await arrivalsRes.json();
      const blockedData = await blockedRes.json();
      const membersData = await membersRes.json();
      const memberArrivalsData = await memberArrivalsRes.json();
      const groupsData = await groupsRes.json();

      setGuests(guestsData);
      setTables(tablesData);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
      
      // Handle both old and new API response formats
      if (assignmentsData.assignments && assignmentsData.seatAllocations) {
        setAssignments(assignmentsData.assignments);
        setSeatAllocations(assignmentsData.seatAllocations);
        if (assignmentsData.partySizeOverrides) {
          setPartySizeOverrides(assignmentsData.partySizeOverrides);
        }
      } else {
        // Old format - just assignments
        setAssignments(assignmentsData);
      }
      
      setBlockedTables(blockedData);

      // Organize members by main guest (legacy system)
      const membersByGuest: Record<number, LegacyGroupMember[]> = {};
      if (Array.isArray(membersData)) {
        membersData.forEach((member: LegacyGroupMember) => {
          if (!membersByGuest[member.mainGuestId]) {
            membersByGuest[member.mainGuestId] = [];
          }
          membersByGuest[member.mainGuestId].push(member);
        });
      }
      setGroupMembers(membersByGuest);
      setMemberArrivals(memberArrivalsData);

      // Convert arrivals to Set format
      const arrivalsMap: Record<string, Set<number>> = {};
      for (const [day, guestIds] of Object.entries(arrivalsData)) {
        arrivalsMap[day] = new Set(guestIds as number[]);
      }
      setArrivedGuests(arrivalsMap);

      // Load departures for each day
      const departuresMap: Record<string, Record<number, Set<number>>> = {};
      for (const day of DAYS) {
        try {
          const deptRes = await fetch(`/api/departures?day=${day.id}`);
          const deptData = await deptRes.json();
          if (Array.isArray(deptData)) {
            if (!departuresMap[day.id]) {
              departuresMap[day.id] = {};
            }
            deptData.forEach((d: { guest_id: number; service_id: number }) => {
              if (!departuresMap[day.id][d.service_id]) {
                departuresMap[day.id][d.service_id] = new Set();
              }
              departuresMap[day.id][d.service_id].add(d.guest_id);
            });
          }
        } catch {
          // Departures table might not exist yet
        }
      }
      setDepartedGuests(departuresMap);

      setLoading(false);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Failed to load data', 'error');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh data every 5 seconds for multi-device sync
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      fetchData();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(refreshInterval);
  }, [fetchData]);

  // Add escape key handler to cancel quick assign mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickAssignMode) {
          setQuickAssignMode(false);
          setSelectedGuest(null);
        }
        if (reassignGuest) {
          setReassignGuest(null);
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [quickAssignMode, reassignGuest]);

  // Memoized lookup maps for performance
  const guestMap = useMemo(() => {
    const map = new Map<number, Guest>();
    guests.forEach(g => map.set(g.id, g));
    return map;
  }, [guests]);

  const tableMap = useMemo(() => {
    const map = new Map<number, Table>();
    tables.forEach(t => map.set(t.id, t));
    return map;
  }, [tables]);

  // Memoized assignment keys by day-service for faster lookups
  const assignmentKeysByDayService = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.keys(assignments).forEach(key => {
      const [day, service] = key.split('-');
      const dayServiceKey = `${day}-${service}`;
      if (!map[dayServiceKey]) {
        map[dayServiceKey] = [];
      }
      map[dayServiceKey].push(key);
    });
    return map;
  }, [assignments]);

  // Memoized guest-to-table lookup for current day
  const guestTableMap = useMemo(() => {
    const map: Record<string, Map<number, number>> = {}; // serviceId -> guestId -> tableId
    services.forEach(service => {
      const serviceMap = new Map<number, number>();
      const dayServiceKey = `${selectedDay}-${service.id}`;
      const keys = assignmentKeysByDayService[dayServiceKey] || [];
      keys.forEach(key => {
        const tableId = parseInt(key.split('-')[2]);
        (assignments[key] || []).forEach(guestId => {
          serviceMap.set(guestId, tableId);
        });
      });
      map[service.id] = serviceMap;
    });
    return map;
  }, [assignments, assignmentKeysByDayService, selectedDay, services]);

  const addGuest = async () => {
    if (!newGuest.name.trim()) return;
    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGuest.name, notes: newGuest.notes, isManuallyAdded: true })
      });
      const guest = await response.json();
      setGuests([...guests, guest]);
      
      // If table and service are assigned, create the assignment
      if (newGuest.assignedTable && newGuest.assignedService) {
        await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            guestId: guest.id, 
            tableId: newGuest.assignedTable, 
            day: selectedDay, 
            serviceId: newGuest.assignedService 
          })
        });
        
        const key = `${selectedDay}-${newGuest.assignedService}-${newGuest.assignedTable}`;
        setAssignments(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), guest.id]
        }));
      }
      
      setNewGuest({ name: '', notes: '', assignedTable: null, assignedService: null });
      setShowGuestForm(false);
      showNotification(`${guest.name} added to guest list`);
    } catch (error) {
      console.error('Error adding guest:', error);
      showNotification('Failed to add guest', 'error');
    }
  };

  const updateGuest = async () => {
    if (!editingGuest || !editingGuest.name.trim()) return;
    try {
      const response = await fetch('/api/guests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingGuest.id,
          name: editingGuest.name,
          notes: editingGuest.notes
        })
      });
      const updatedGuest = await response.json();
      setGuests(guests.map(g => g.id === editingGuest.id ? { ...editingGuest, ...updatedGuest } : g));
      setShowEditGuest(false);
      setEditingGuest(null);
      showNotification(`${editingGuest.name} updated`);
    } catch (error) {
      console.error('Error updating guest:', error);
      showNotification('Failed to update guest', 'error');
    }
  };

  const toggleGhost = async (guestId: number) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return;
    
    const newGhostStatus = !guest.isGhost;
    
    try {
      await fetch('/api/guests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          isGhost: newGhostStatus
        })
      });
      
      setGuests(guests.map(g => 
        g.id === guestId ? { ...g, isGhost: newGhostStatus } : g
      ));
      
      showNotification(newGhostStatus ? `${guest.name} marked as ghost (excluded from final count)` : `${guest.name} included in final count`);
    } catch (error) {
      console.error('Error toggling ghost status:', error);
      showNotification('Failed to update ghost status', 'error');
    }
  };

  const addTable = async () => {
    if (!newTable.name.trim()) return;
    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTable)
      });
      const table = await response.json();
      setTables([...tables, table]);
      setNewTable({ name: '', capacity: 6 });
      setShowTableForm(false);
      showNotification(`${table.name} added`);
    } catch (error) {
      console.error('Error adding table:', error);
      showNotification('Failed to add table', 'error');
    }
  };

  const deleteGuest = async (guestId: number) => {
    try {
      await fetch(`/api/guests?id=${guestId}`, { method: 'DELETE' });
      setGuests(guests.filter(g => g.id !== guestId));
      
      // Update local assignments
      const newAssignments = { ...assignments };
      Object.keys(newAssignments).forEach(key => {
        newAssignments[key] = newAssignments[key].filter(id => id !== guestId);
      });
      setAssignments(newAssignments);
      showNotification('Guest removed');
    } catch (error) {
      console.error('Error deleting guest:', error);
      showNotification('Failed to delete guest', 'error');
    }
  };

  const deleteTable = async (tableId: number) => {
    try {
      await fetch(`/api/tables?id=${tableId}`, { method: 'DELETE' });
      setTables(tables.filter(t => t.id !== tableId));
      
      // Update local assignments
      const newAssignments = { ...assignments };
      services.forEach(service => {
        DAYS.forEach(day => {
          delete newAssignments[`${day.id}-${service.id}-${tableId}`];
        });
      });
      setAssignments(newAssignments);
      showNotification('Table removed');
    } catch (error) {
      console.error('Error deleting table:', error);
      showNotification('Failed to delete table', 'error');
    }
  };

  const toggleArrival = async (guestId: number) => {
    const dayArrivals = arrivedGuests[selectedDay] || new Set();
    const newDayArrivals = new Set(dayArrivals);
    const arrived = !newDayArrivals.has(guestId);
    
    try {
      await fetch('/api/arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, day: selectedDay, arrived })
      });

      if (arrived) {
        newDayArrivals.add(guestId);
        const guest = guests.find(g => g.id === guestId);
        showNotification(`${guest?.name} has arrived!`, 'success');
      } else {
        newDayArrivals.delete(guestId);
        const guest = guests.find(g => g.id === guestId);
        showNotification(`${guest?.name} marked as not arrived`);
      }
      
      setArrivedGuests(prev => ({
        ...prev,
        [selectedDay]: newDayArrivals
      }));
    } catch (error) {
      console.error('Error toggling arrival:', error);
      showNotification('Failed to update arrival', 'error');
    }
  };

  const hasArrived = (guestId: number) => {
    const dayArrivals = arrivedGuests[selectedDay];
    return dayArrivals ? dayArrivals.has(guestId) : false;
  };

  const toggleDeparture = async (guestId: number, serviceId: number) => {
    const dayDepartures = departedGuests[selectedDay]?.[serviceId] || new Set();
    const departed = !dayDepartures.has(guestId);
    
    try {
      if (departed) {
        await fetch('/api/departures', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId, day: selectedDay, serviceId })
        });
      } else {
        await fetch(`/api/departures?guestId=${guestId}&day=${selectedDay}&serviceId=${serviceId}`, {
          method: 'DELETE'
        });
      }

      setDepartedGuests(prev => {
        const newDepartures = { ...prev };
        if (!newDepartures[selectedDay]) {
          newDepartures[selectedDay] = {};
        }
        if (!newDepartures[selectedDay][serviceId]) {
          newDepartures[selectedDay][serviceId] = new Set();
        }
        const newServiceDepartures = new Set(newDepartures[selectedDay][serviceId]);
        if (departed) {
          newServiceDepartures.add(guestId);
        } else {
          newServiceDepartures.delete(guestId);
        }
        newDepartures[selectedDay][serviceId] = newServiceDepartures;
        return newDepartures;
      });

      const guest = guests.find(g => g.id === guestId);
      if (departed) {
        showNotification(`${guest?.name} has left`);
      } else {
        showNotification(`${guest?.name} marked as still present`);
      }
    } catch (error) {
      console.error('Error toggling departure:', error);
      showNotification('Failed to update departure', 'error');
    }
  };

  const hasDeparted = (guestId: number, serviceId: number) => {
    return departedGuests[selectedDay]?.[serviceId]?.has(guestId) || false;
  };

  const toggleBlockTable = async (tableId: number, serviceId: number) => {
    const key = `${selectedDay}-${serviceId}-${tableId}`;
    const blocked = !blockedTables[key];
    
    try {
      await fetch('/api/blocked-tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, day: selectedDay, serviceId, blocked })
      });

      setBlockedTables(prev => ({
        ...prev,
        [key]: blocked
      }));
    } catch (error) {
      console.error('Error toggling block:', error);
      showNotification('Failed to update table block', 'error');
    }
  };

  const isTableBlocked = (tableId: number, serviceId: number, day = selectedDay) => {
    const key = `${day}-${serviceId}-${tableId}`;
    return blockedTables[key] || false;
  };

  const quickReassign = async (guestId: number, fromTableId: number, toTableId: number, serviceId: number) => {
    try {
      // Delete old assignment
      await fetch(`/api/assignments?guestId=${guestId}&tableId=${fromTableId}&day=${selectedDay}&serviceId=${serviceId}`, {
        method: 'DELETE'
      });

      // Create new assignment
      await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, tableId: toTableId, day: selectedDay, serviceId })
      });

      // Update local state
      const fromKey = `${selectedDay}-${serviceId}-${fromTableId}`;
      const toKey = `${selectedDay}-${serviceId}-${toTableId}`;
      
      setAssignments(prev => {
        const newAssignments = { ...prev };
        newAssignments[fromKey] = (newAssignments[fromKey] || []).filter(id => id !== guestId);
        if (newAssignments[fromKey].length === 0) {
          delete newAssignments[fromKey];
        }
        newAssignments[toKey] = [...(newAssignments[toKey] || []), guestId];
        return newAssignments;
      });
      
      const guest = guests.find(g => g.id === guestId);
      const toTable = tables.find(t => t.id === toTableId);
      showNotification(`${guest?.name} moved to ${toTable?.name}`);
      setReassignGuest(null);
    } catch (error) {
      console.error('Error reassigning guest:', error);
      showNotification('Failed to reassign guest', 'error');
    }
  };

  // Move entire group to a new table
  const quickReassignGroup = async (leadGuestId: number, groupId: number, toTableId: number, serviceId: number) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;
      
      // Get all guest IDs in this group
      const guestIds = [leadGuestId, ...group.members.map(m => m.guestId)];
      
      // First, unassign all group members from their current tables
      for (const guestId of guestIds) {
        const currentTable = getAssignedTable(guestId, serviceId);
        if (currentTable) {
          await fetch(`/api/assignments?guestId=${guestId}&tableId=${currentTable.id}&day=${selectedDay}&serviceId=${serviceId}`, {
            method: 'DELETE'
          });
        }
      }
      
      // Then assign all to the new table
      for (const guestId of guestIds) {
        await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId, tableId: toTableId, day: selectedDay, serviceId })
        });
      }
      
      // Update local state
      setAssignments(prev => {
        const newAssignments = { ...prev };
        
        // Remove from all tables
        Object.keys(newAssignments).forEach(key => {
          if (key.startsWith(`${selectedDay}-${serviceId}-`)) {
            newAssignments[key] = newAssignments[key].filter(id => !guestIds.includes(id));
            if (newAssignments[key].length === 0) {
              delete newAssignments[key];
            }
          }
        });
        
        // Add to new table
        const toKey = `${selectedDay}-${serviceId}-${toTableId}`;
        newAssignments[toKey] = [...(newAssignments[toKey] || []), ...guestIds];
        
        return newAssignments;
      });
      
      const toTable = tables.find(t => t.id === toTableId);
      const groupName = group.name || `${guests.find(g => g.id === leadGuestId)?.name}'s group`;
      showNotification(`${groupName} (${guestIds.length} people) moved to ${toTable?.name}`);
      setReassignGuest(null);
    } catch (error) {
      console.error('Error reassigning group:', error);
      showNotification('Failed to move group', 'error');
    }
  };

  const reassignMultipleGuests = async (guestIds: number[], fromTableId: number, toTableId: number, serviceId: number) => {
    try {
      for (const guestId of guestIds) {
        // Delete old assignment
        await fetch(`/api/assignments?guestId=${guestId}&tableId=${fromTableId}&day=${selectedDay}&serviceId=${serviceId}`, {
          method: 'DELETE'
        });

        // Create new assignment
        const guest = guests.find(g => g.id === guestId);
        if (guest) {
          await fetch('/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              guestId, 
              tableId: toTableId, 
              day: selectedDay, 
              serviceId,
              seats: 1  // Each guest = 1 seat
            })
          });
        }
      }

      // Update local state
      const fromKey = `${selectedDay}-${serviceId}-${fromTableId}`;
      const toKey = `${selectedDay}-${serviceId}-${toTableId}`;
      
      setAssignments(prev => {
        const newAssignments = { ...prev };
        
        // Remove all selected guests from old table
        guestIds.forEach(guestId => {
          newAssignments[fromKey] = (newAssignments[fromKey] || []).filter(id => id !== guestId);
        });
        
        if (newAssignments[fromKey]?.length === 0) {
          delete newAssignments[fromKey];
        }
        
        // Add all guests to new table (1 entry per guest)
        guestIds.forEach(guestId => {
          const guest = guests.find(g => g.id === guestId);
          if (guest) {
            newAssignments[toKey] = [...(newAssignments[toKey] || []), guestId];
          }
        });
        
        return newAssignments;
      });

      // Update seat allocations
      guestIds.forEach(guestId => {
        const guest = guests.find(g => g.id === guestId);
        if (guest) {
          const allocKey = `${selectedDay}-${serviceId}-${guestId}`;
          setSeatAllocations(prev => {
            const newAllocs = { ...prev };
            if (newAllocs[allocKey]) {
              delete newAllocs[allocKey][fromTableId];
              if (Object.keys(newAllocs[allocKey]).length === 0) {
                delete newAllocs[allocKey];
              }
            }
            return {
              ...newAllocs,
              [allocKey]: {
                ...(newAllocs[allocKey] || {}),
                [toTableId]: 1  // Each guest = 1 seat
              }
            };
          });
        }
      });
      
      const toTable = tables.find(t => t.id === toTableId);
      showNotification(`${guestIds.length} guest${guestIds.length > 1 ? 's' : ''} moved to ${toTable?.name}`);
      setReassignGuests(null);
    } catch (error) {
      console.error('Error reassigning guests:', error);
      showNotification('Failed to reassign guests', 'error');
    }
  };

  const importGuests = async () => {
    const lines = importText.split('\n').filter(line => line.trim());
    const newGuests: Guest[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(',').map(p => p.trim());
      try {
        const response = await fetch('/api/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: parts[0] || `Guest ${i + 1}`,
            notes: parts[1] || ''  // Second column is now notes, not party size
          })
        });
        const guest = await response.json();
        newGuests.push(guest);
      } catch (error) {
        console.error('Error importing guest:', error);
      }
    }
    
    setGuests([...guests, ...newGuests]);
    setImportText('');
    setShowImport(false);
    showNotification(`${newGuests.length} guests imported`);
  };

  const importExcelFile = async (file: File) => {
    setIsImporting(true);
    setImportProgress({ current: 0, total: 0 });
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
      
      // First pass: count valid rows
      const validRows: { name: string; notes: string }[] = [];
      let skippedHeader = false;
      
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length === 0) continue;
        
        const name = String(row[0] || '').trim();
        if (!name) continue;
        
        // Skip header row if it looks like a header
        if (!skippedHeader && (
          name.toLowerCase() === 'name' || 
          name.toLowerCase() === 'guest' || 
          name.toLowerCase() === 'nom' ||
          name.toLowerCase() === 'guests'
        )) {
          skippedHeader = true;
          continue;
        }
        
        const notes = row[1] ? String(row[1]).trim() : '';
        validRows.push({ name, notes });
      }
      
      setImportProgress({ current: 0, total: validRows.length });
      
      const newGuests: Guest[] = [];
      
      // Import in batches for better performance
      const batchSize = 10;
      for (let i = 0; i < validRows.length; i += batchSize) {
        const batch = validRows.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async ({ name, notes }) => {
          try {
            const response = await fetch('/api/guests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, notes })
            });
            return await response.json();
          } catch (error) {
            console.error('Error importing guest:', error);
            return null;
          }
        });
        
        const results = await Promise.all(batchPromises);
        results.forEach(guest => {
          if (guest) newGuests.push(guest);
        });
        
        setImportProgress({ current: Math.min(i + batchSize, validRows.length), total: validRows.length });
      }
      
      setGuests([...guests, ...newGuests]);
      setShowImport(false);
      showNotification(`${newGuests.length} guests imported from Excel`);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      showNotification('Failed to read Excel file', 'error');
    } finally {
      setIsImporting(false);
      setImportProgress({ current: 0, total: 0 });
    }
  };

  const deleteGroupMember = async (memberId: number, mainGuestId: number) => {
    try {
      await fetch(`/api/group-members?id=${memberId}`, {
        method: 'DELETE'
      });
      
      setGroupMembers(prev => ({
        ...prev,
        [mainGuestId]: (prev[mainGuestId] || []).filter(m => m.id !== memberId)
      }));
      
      showNotification('Member removed from group');
    } catch (error) {
      console.error('Error deleting member:', error);
      showNotification('Failed to remove member', 'error');
    }
  };

  const toggleMemberArrival = async (memberId: number) => {
    const currentStatus = memberArrivals[selectedDay]?.[memberId] || false;
    
    try {
      await fetch('/api/member-arrivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          day: selectedDay,
          arrived: !currentStatus
        })
      });
      
      setMemberArrivals(prev => ({
        ...prev,
        [selectedDay]: {
          ...(prev[selectedDay] || {}),
          [memberId]: !currentStatus
        }
      }));
    } catch (error) {
      console.error('Error toggling member arrival:', error);
      showNotification('Failed to update arrival', 'error');
    }
  };

  // Legacy function - kept for backward compatibility but uses new system
  const getTotalGroupSize = (guest: Guest) => {
    return getGuestTotalGroupSize(guest.id);
  };

  const getArrivalStatus = (guest: Guest) => {
    const mainArrived = hasArrived(guest.id);
    const members = groupMembers[guest.id] || [];
    const arrivedMembers = members.filter(m => 
      memberArrivals[selectedDay]?.[m.id]
    ).length;
    
    const total = 1 + members.length;
    const arrived = (mainArrived ? 1 : 0) + arrivedMembers;
    
    return { 
      arrived, 
      total, 
      isPartial: arrived > 0 && arrived < total,
      isComplete: arrived === total && total > 0,
      percentage: total > 0 ? Math.round((arrived / total) * 100) : 0
    };
  };


  const assignGuest = async (guestId: number, tableId: number, serviceId: number, isGroupMember = false, specificGroupId?: number) => {
    try {
      const guest = guests.find(g => g.id === guestId);
      if (!guest) return;
      
      // Check if this guest leads any groups
      const ledGroups = getGroupsAsLead(guestId);
      
      // If guest leads multiple groups and no specific group selected, show selection popup
      if (ledGroups.length > 1 && !isGroupMember && specificGroupId === undefined) {
        setSelectGroupForAssign({ guest, tableId, groups: ledGroups });
        return;
      }
      
      // If guest is a group lead and not being called as part of group assignment, 
      // assign the whole group instead
      if (ledGroups.length > 0 && !isGroupMember) {
        const groupToAssign = specificGroupId 
          ? ledGroups.find(g => g.id === specificGroupId) 
          : ledGroups[0];
        if (groupToAssign) {
          await assignGroupToTable(guestId, tableId, serviceId, groupToAssign.id);
        }
        return;
      }
      
      // Check if guest is a member of a group (not leader) - show popup to choose
      if (!isGroupMember) {
        const memberOfGroups = getGroupsAsMember(guestId);
        if (memberOfGroups.length > 0) {
          setGroupMemberAction({
            guest,
            tableId,
            groupId: memberOfGroups[0].id,
            leadGuestId: memberOfGroups[0].leadGuestId,
            isMove: false
          });
          return;
        }
      }
      
      // Individual guest assignment
      await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guestId, 
          tableId, 
          day: selectedDay, 
          serviceId
        })
      });

      // Update local state - remove from old assignment if exists
      const newAssignments = { ...assignments };
      const existingKey = Object.keys(newAssignments).find(k => 
        k.startsWith(`${selectedDay}-${serviceId}-`) && newAssignments[k].includes(guestId)
      );
      
      if (existingKey) {
        newAssignments[existingKey] = newAssignments[existingKey].filter(id => id !== guestId);
        if (newAssignments[existingKey].length === 0) {
          delete newAssignments[existingKey];
        }
      }
      
      // Add guest ID (1 seat per guest)
      const key = `${selectedDay}-${serviceId}-${tableId}`;
      newAssignments[key] = [...(newAssignments[key] || []), guestId];
      setAssignments(newAssignments);
      
      // Update seat allocations
      const allocKey = `${selectedDay}-${serviceId}-${guestId}`;
      setSeatAllocations(prev => ({
        ...prev,
        [allocKey]: {
          ...(prev[allocKey] || {}),
          [tableId]: 1
        }
      }));
      
      if (!isGroupMember) {
        setSelectedGuest(null);
        setQuickAssignMode(false);
        
        const table = tables.find(t => t.id === tableId);
        showNotification(`${guest?.name} assigned to ${table?.name}`);
      }
    } catch (error) {
      console.error('Error assigning guest:', error);
      if (!isGroupMember) {
        showNotification('Failed to assign guest', 'error');
      }
    }
  };

  const unassignGuest = async (guestId: number, tableId: number, serviceId: number) => {
    try {
      await fetch(`/api/assignments?guestId=${guestId}&tableId=${tableId}&day=${selectedDay}&serviceId=${serviceId}`, {
        method: 'DELETE'
      });

      const key = `${selectedDay}-${serviceId}-${tableId}`;
      setAssignments(prev => ({
        ...prev,
        [key]: (prev[key] || []).filter(id => id !== guestId)
      }));
      
      const guest = guests.find(g => g.id === guestId);
      showNotification(`${guest?.name} unassigned`);
    } catch (error) {
      console.error('Error unassigning guest:', error);
      showNotification('Failed to unassign guest', 'error');
    }
  };

  const handleTableDrag = async (tableId: number, x: number, y: number) => {
    try {
      await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tableId, x, y })
      });

      setTables(prev => prev.map(t => 
        t.id === tableId ? { ...t, x, y } : t
      ));
    } catch (error) {
      console.error('Error updating table position:', error);
    }
  };

  const handleAddTableFromEditor = async (name: string, capacity: number) => {
    try {
      const response = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, capacity })
      });
      const table = await response.json();
      setTables([...tables, table]);
      showNotification(`${table.name} added`);
    } catch (error) {
      console.error('Error adding table:', error);
      showNotification('Failed to add table', 'error');
    }
  };

  const getTableOccupancy = (tableId: number, serviceId: number, day = selectedDay) => {
    const key = `${day}-${serviceId}-${tableId}`;
    const assignedGuests = assignments[key] || [];
    
    // Count unique guests - each guest takes exactly 1 seat
    const uniqueGuests = [...new Set(assignedGuests)];
    return uniqueGuests.reduce((total, guestId) => {
      const allocKey = `${day}-${serviceId}-${guestId}`;
      const seats = seatAllocations[allocKey]?.[tableId];
      
      if (seats !== undefined) {
        // Use the actual seat allocation for split groups
        return total + seats;
      } else {
        // Each guest = 1 seat
        return total + 1;
      }
    }, 0);
  };

  const getAssignedTable = (guestId: number, serviceId: number, day: string = selectedDay) => {
    // Use memoized lookup for current day
    if (day === selectedDay && guestTableMap[serviceId]) {
      const tableId = guestTableMap[serviceId].get(guestId);
      if (tableId !== undefined) {
        return tableMap.get(tableId) || null;
      }
      return null;
    }
    // Fall back to loop for other days
    const dayServiceKey = `${day}-${serviceId}`;
    const keys = assignmentKeysByDayService[dayServiceKey] || [];
    for (const key of keys) {
      if (assignments[key].includes(guestId)) {
        const tableId = parseInt(key.split('-')[2]);
        return tableMap.get(tableId) || null;
      }
    }
    return null;
  };

  const getUnassignedGuests = (serviceId: number) => {
    // Use memoized map for faster lookup
    const assignedGuestIds = guestTableMap[serviceId] || new Map();
    return guests.filter(g => !assignedGuestIds.has(g.id));
  };

  // Get all groups where a guest is the lead - using memoized lookup
  const groupsByLead = useMemo(() => {
    const map = new Map<number, Group[]>();
    groups.forEach(g => {
      const existing = map.get(g.leadGuestId) || [];
      map.set(g.leadGuestId, [...existing, g]);
    });
    return map;
  }, [groups]);

  const getGroupsAsLead = (guestId: number): Group[] => {
    return groupsByLead.get(guestId) || [];
  };

  // Get all groups where a guest is a member (not lead) - using memoized lookup
  const groupsByMember = useMemo(() => {
    const map = new Map<number, Group[]>();
    groups.forEach(g => {
      g.members.forEach(m => {
        const existing = map.get(m.guestId) || [];
        map.set(m.guestId, [...existing, g]);
      });
    });
    return map;
  }, [groups]);

  const getGroupsAsMember = (guestId: number): Group[] => {
    return groupsByMember.get(guestId) || [];
  };

  // Get total size of a group (lead + members, excluding ghosts from count but not from seating)
  const getGroupSize = (group: Group): number => {
    // For seating purposes, count everyone (including ghosts as they need seats)
    return 1 + group.members.length;
  };

  // Get total size of all groups led by a guest (for seat allocation)
  const getGuestTotalGroupSize = (guestId: number): number => {
    const ledGroups = getGroupsAsLead(guestId);
    if (ledGroups.length === 0) return 1; // Solo guest
    // Return the size of the first/primary group (guests can lead multiple groups)
    return getGroupSize(ledGroups[0]);
  };

  // Get largest available table capacity for a service
  const getLargestAvailableCapacity = (serviceId: number): number => {
    let largest = 0;
    tables.forEach(table => {
      if (!isTableBlocked(table.id, serviceId)) {
        const occupancy = getTableOccupancy(table.id, serviceId);
        const available = table.capacity - occupancy;
        if (available > largest) {
          largest = available;
        }
      }
    });
    return largest;
  };

  // Check if a group needs to be split (group size > largest available table)
  const needsSplit = (guestId: number, serviceId: number): boolean => {
    const groupSize = getGuestTotalGroupSize(guestId);
    if (groupSize <= 1) return false;
    
    const largestAvailable = getLargestAvailableCapacity(serviceId);
    return groupSize > largestAvailable;
  };

  const canFitInSingleTable = (guestId: number, serviceId: number) => {
    const guest = guests.find(g => g.id === guestId);
    if (!guest) return true;
    
    // Check if already assigned
    const isAssigned = getAssignedTable(guestId, serviceId);
    if (isAssigned) return true;
    
    // Get the group size for this guest
    const groupSize = getGuestTotalGroupSize(guestId);
    
    // Check if any table has enough space
    return tables.some(table => {
      const isBlocked = isTableBlocked(table.id, serviceId);
      if (isBlocked) return false;
      const occupancy = getTableOccupancy(table.id, serviceId);
      return (table.capacity - occupancy) >= groupSize;
    });
  };

  const getGuestTableAssignments = (guestId: number, serviceId: number, day = selectedDay) => {
    const assignedTables: Table[] = [];
    Object.keys(assignments).forEach(key => {
      if (key.startsWith(`${day}-${serviceId}-`)) {
        const guestIds = assignments[key] || [];
        if (guestIds.includes(guestId)) {
          const tableId = parseInt(key.split('-')[2]);
          const table = tables.find(t => t.id === tableId);
          if (table) assignedTables.push(table);
        }
      }
    });
    return assignedTables;
  };

  // Check if a group is incomplete (not all members assigned)
  const getGroupStatus = (group: Group, serviceId: number): { isIncomplete: boolean; assignedCount: number; totalCount: number; unassignedMembers: { id: number; name: string }[] } => {
    const totalCount = 1 + group.members.length; // lead + members
    const unassignedMembers: { id: number; name: string }[] = [];
    
    // Check lead
    const leadAssigned = getAssignedTable(group.leadGuestId, serviceId);
    if (!leadAssigned) {
      unassignedMembers.push({ id: group.leadGuestId, name: group.leadGuestName });
    }
    
    // Check members
    group.members.forEach(member => {
      const memberAssigned = getAssignedTable(member.guestId, serviceId);
      if (!memberAssigned) {
        unassignedMembers.push({ id: member.guestId, name: member.guestName });
      }
    });
    
    const assignedCount = totalCount - unassignedMembers.length;
    return {
      isIncomplete: unassignedMembers.length > 0 && assignedCount > 0,
      assignedCount,
      totalCount,
      unassignedMembers
    };
  };

  // Get what group a guest belongs to (as member or lead)
  const getGuestGroup = (guestId: number): Group | null => {
    // Check if lead of any group
    const asLead = groups.find(g => g.leadGuestId === guestId);
    if (asLead) return asLead;
    
    // Check if member of any group
    const asMember = groups.find(g => g.members.some(m => m.guestId === guestId));
    return asMember || null;
  };

  // Check if a group has all members assigned to the same table (or any assignment at all)
  const getGroupAssignmentStatus = (groupId: number, serviceId: number): { 
    isComplete: boolean; 
    isSplit: boolean; 
    assignedCount: number; 
    totalCount: number;
    tableIds: number[];
    missingMembers: Guest[];
    isActiveForService: boolean; // New: true if this group is the one being used for this service
  } => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return { isComplete: false, isSplit: false, assignedCount: 0, totalCount: 0, tableIds: [], missingMembers: [], isActiveForService: false };
    
    const allMemberIds = [group.leadGuestId, ...group.members.map(m => m.guestId)];
    const memberOnlyIds = group.members.map(m => m.guestId); // Members excluding leader
    const totalCount = allMemberIds.length;
    const tableIds = new Set<number>();
    const assignedIds = new Set<number>();
    const missingMembers: Guest[] = [];
    
    // Check if leader is assigned
    const leaderTable = getAssignedTable(group.leadGuestId, serviceId);
    
    // Check how many members (excluding leader) of THIS group are assigned
    let membersAssignedCount = 0;
    memberOnlyIds.forEach(guestId => {
      const table = getAssignedTable(guestId, serviceId);
      if (table) {
        membersAssignedCount++;
      }
    });
    
    // Determine if this group is active for this service:
    // - If no members, then the group is just the leader - check if leader is assigned
    // - If has members, the group is active if at least one member (not leader) is assigned
    // - This prevents other groups with same leader from showing as "partial" when they're not being used
    const isActiveForService = memberOnlyIds.length === 0 
      ? !!leaderTable 
      : membersAssignedCount > 0;
    
    // Only calculate full status if this group is active for this service
    if (isActiveForService) {
      allMemberIds.forEach(guestId => {
        const table = getAssignedTable(guestId, serviceId);
        if (table) {
          tableIds.add(table.id);
          assignedIds.add(guestId);
        } else {
          const guest = guests.find(g => g.id === guestId);
          if (guest) missingMembers.push(guest);
        }
      });
    }
    
    const assignedCount = assignedIds.size;
    const isComplete = assignedCount === totalCount && tableIds.size === 1;
    const isSplit = tableIds.size > 1;
    
    return { isComplete, isSplit, assignedCount, totalCount, tableIds: [...tableIds], missingMembers, isActiveForService };
  };

  // Get all guests at a table grouped by their group membership
  const getTableGuestsGrouped = (tableId: number, serviceId: number): { groupId: number | null; groupName: string | null; guests: Guest[] }[] => {
    const key = `${selectedDay}-${serviceId}-${tableId}`;
    const guestIds = assignments[key] || [];
    const guestsAtTable = guestIds.map(id => guests.find(g => g.id === id)).filter(Boolean) as Guest[];
    const guestIdsSet = new Set(guestIds);
    
    // First, find all groups that have members at this table
    const activeGroupsAtTable: Map<number, { group: Group; members: Guest[] }> = new Map();
    
    groups.forEach(group => {
      const allGroupMemberIds = [group.leadGuestId, ...group.members.map(m => m.guestId)];
      const membersAtTable = allGroupMemberIds.filter(id => guestIdsSet.has(id));
      
      // A group is active at this table if:
      // - It has members (not just leader) and at least one member is at this table, OR
      // - It has no members and the leader is at this table
      const memberOnlyIds = group.members.map(m => m.guestId);
      const memberOnlyAtTable = memberOnlyIds.filter(id => guestIdsSet.has(id));
      
      const isActiveHere = memberOnlyIds.length === 0 
        ? guestIdsSet.has(group.leadGuestId)
        : memberOnlyAtTable.length > 0;
      
      if (isActiveHere && membersAtTable.length > 0) {
        activeGroupsAtTable.set(group.id, {
          group,
          members: membersAtTable.map(id => guests.find(g => g.id === id)).filter(Boolean) as Guest[]
        });
      }
    });
    
    // Build result: group guests by their active group
    const result: { groupId: number | null; groupName: string | null; guests: Guest[] }[] = [];
    const assignedToGroup = new Set<number>();
    
    // Add guests by group
    activeGroupsAtTable.forEach(({ group, members }, groupId) => {
      const groupName = group.name || `${group.leadGuestName}'s group`;
      result.push({ groupId, groupName, guests: members });
      members.forEach(g => assignedToGroup.add(g.id));
    });
    
    // Add ungrouped guests (those not in any active group at this table)
    const ungroupedGuests = guestsAtTable.filter(g => !assignedToGroup.has(g.id));
    if (ungroupedGuests.length > 0) {
      result.unshift({ groupId: null, groupName: null, guests: ungroupedGuests });
    }
    
    return result;
  };

  const isDuplicateGuest = (guest: Guest) => {
    return guests.filter(g => g.name.trim().toLowerCase() === guest.name.trim().toLowerCase()).length > 1;
  };

  const addGroupMember = async (mainGuestId: number, name: string) => {
    try {
      const response = await fetch('/api/group-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mainGuestId, name })
      });
      const newMember = await response.json();
      
      setGroupMembers(prev => ({
        ...prev,
        [mainGuestId]: [...(prev[mainGuestId] || []), newMember]
      }));
      
      showNotification(`${name} added to group`);
      return newMember;
    } catch (error) {
      console.error('Error adding member:', error);
      showNotification('Failed to add member', 'error');
    }
  };

  // New group system functions
  const createGroup = async (leadGuestId: number, name?: string) => {
    try {
      const response = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadGuestId, name: name || null })
      });
      const newGroup = await response.json();
      
      if (newGroup.error) {
        showNotification(newGroup.error, 'error');
        return null;
      }
      
      setGroups(prev => [...prev, newGroup]);
      showNotification(`Group created with ${newGroup.leadGuestName} as lead`);
      return newGroup;
    } catch (error) {
      console.error('Error creating group:', error);
      showNotification('Failed to create group', 'error');
      return null;
    }
  };

  const deleteGroup = async (groupId: number) => {
    try {
      await fetch(`/api/groups?id=${groupId}`, { method: 'DELETE' });
      setGroups(prev => prev.filter(g => g.id !== groupId));
      showNotification('Group deleted');
    } catch (error) {
      console.error('Error deleting group:', error);
      showNotification('Failed to delete group', 'error');
    }
  };

  const updateGroupName = async (groupId: number, name: string) => {
    try {
      await fetch('/api/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: groupId, name: name || null })
      });
      
      setGroups(prev => prev.map(g => 
        g.id === groupId ? { ...g, name: name || null } : g
      ));
      
      // Also update editingGroup if it's the same group
      if (editingGroup && editingGroup.id === groupId) {
        setEditingGroup(prev => prev ? { ...prev, name: name || null } : null);
      }
      
      showNotification(name ? `Group renamed to "${name}"` : 'Group name cleared');
    } catch (error) {
      console.error('Error updating group:', error);
      showNotification('Failed to update group name', 'error');
    }
  };

  const addMemberToGroup = async (groupId: number, guestId: number) => {
    try {
      const response = await fetch('/api/group-memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, guestId })
      });
      const result = await response.json();
      
      if (result.error) {
        showNotification(result.error, 'error');
        return null;
      }
      
      // Update local state
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            members: [...g.members, {
              id: result.id,
              guestId: result.guestId,
              guestName: result.guestName,
              isGhost: result.isGhost
            }]
          };
        }
        return g;
      }));
      
      showNotification(`${result.guestName} added to group`);
      return result;
    } catch (error) {
      console.error('Error adding member to group:', error);
      showNotification('Failed to add member', 'error');
      return null;
    }
  };

  const removeMemberFromGroup = async (groupId: number, guestId: number) => {
    try {
      await fetch(`/api/group-memberships?groupId=${groupId}&guestId=${guestId}`, { 
        method: 'DELETE' 
      });
      
      // Update local state
      setGroups(prev => prev.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            members: g.members.filter(m => m.guestId !== guestId)
          };
        }
        return g;
      }));
      
      showNotification('Member removed from group');
    } catch (error) {
      console.error('Error removing member:', error);
      showNotification('Failed to remove member', 'error');
    }
  };

  // Create a guest and optionally add to a group
  const createGuestAndAddToGroup = async (name: string, groupId?: number) => {
    try {
      // First create the guest
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, notes: '' })
      });
      const newGuest = await response.json();
      
      setGuests(prev => [...prev, newGuest]);
      
      // If groupId provided, add to group
      if (groupId) {
        await addMemberToGroup(groupId, newGuest.id);
      } else {
        showNotification(`${name} added to guest list`);
      }
      
      return newGuest;
    } catch (error) {
      console.error('Error creating guest:', error);
      showNotification('Failed to create guest', 'error');
      return null;
    }
  };

  // Assign a group lead to a table (automatically assigns all members too)
  const assignGroupToTable = async (leadGuestId: number, tableId: number, serviceId: number, specificGroupId?: number) => {
    const ledGroups = getGroupsAsLead(leadGuestId);
    const lead = guests.find(g => g.id === leadGuestId);
    
    // Get the specific group or all groups
    const groupsToAssign = specificGroupId 
      ? ledGroups.filter(g => g.id === specificGroupId)
      : ledGroups;
    
    // Get all guest IDs to assign (lead + all members from selected group(s))
    const guestIdsToAssign = new Set<number>([leadGuestId]);
    groupsToAssign.forEach(group => {
      group.members.forEach(member => {
        guestIdsToAssign.add(member.guestId);
      });
    });

    // Assign each guest (with isGroupMember flag to avoid notifications for each)
    for (const guestId of guestIdsToAssign) {
      await assignGuest(guestId, tableId, serviceId, true);
    }
    
    setSelectedGuest(null);
    setQuickAssignMode(false);
    setSelectGroupForAssign(null);
    
    const table = tables.find(t => t.id === tableId);
    const groupSize = guestIdsToAssign.size;
    const groupName = specificGroupId 
      ? groupsToAssign[0]?.name || `${lead?.name}'s group`
      : `${lead?.name}'s group`;
    showNotification(`${groupName} (${groupSize} people) assigned to ${table?.name}`);
  };

  const openSplitEditMode = (guest: Guest, serviceId: number) => {
    const assignedTables = getGuestTableAssignments(guest.id, serviceId);
    setSplittingGuest(guest);
    
    // Get actual seat counts from seatAllocations
    const allocKey = `${selectedDay}-${serviceId}-${guest.id}`;
    const currentSeats = seatAllocations[allocKey] || {};
    
    // Initialize allocations with current assignments
    const availableTables = tables
      .filter(t => !isTableBlocked(t.id, serviceId))
      .map(t => {
        const allocated = currentSeats[t.id] || 0;
        const occupancy = getTableOccupancy(t.id, serviceId);
        // For already assigned tables, add back the allocated seats to available
        const adjustedOccupancy = allocated > 0 ? occupancy - allocated : occupancy;
        return {
          tableId: t.id,
          seats: allocated,
          available: t.capacity - adjustedOccupancy
        };
      })
      .filter(t => t.available > 0 || t.seats > 0);
    
    setSplitAllocations(availableTables);
    setShowSplitGroup(true);
  };

  const handleSplitGroup = async () => {
    if (!splittingGuest || splitAllocations.length === 0) return;
    
    const groupSize = getGuestTotalGroupSize(splittingGuest.id);
    const totalAllocated = splitAllocations.reduce((sum, alloc) => sum + alloc.seats, 0);
    if (totalAllocated !== groupSize) {
      showNotification(`Total allocated seats must equal group size (${groupSize})`, 'error');
      return;
    }

    try {
      // First, remove all existing assignments for this guest in this service
      const existingTables = getGuestTableAssignments(splittingGuest.id, selectedService);
      for (const table of existingTables) {
        const key = `${selectedDay}-${selectedService}-${table.id}`;
        await fetch('/api/assignments', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            guestId: splittingGuest.id, 
            tableId: table.id, 
            day: selectedDay, 
            serviceId: selectedService 
          })
        });
        
        // Update local state - remove all instances of this guest from this table
        setAssignments(prev => ({
          ...prev,
          [key]: (prev[key] || []).filter(id => id !== splittingGuest.id)
        }));
        
        // Clean up seat allocations
        const allocKey = `${selectedDay}-${selectedService}-${splittingGuest.id}`;
        setSeatAllocations(prev => {
          const newAllocs = { ...prev };
          if (newAllocs[allocKey]) {
            delete newAllocs[allocKey][table.id];
            if (Object.keys(newAllocs[allocKey]).length === 0) {
              delete newAllocs[allocKey];
            }
          }
          return newAllocs;
        });
      }
      
      // Then create new assignments for each table
      for (const allocation of splitAllocations) {
        if (allocation.seats > 0) {
          await fetch('/api/assignments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              guestId: splittingGuest.id, 
              tableId: allocation.tableId, 
              day: selectedDay, 
              serviceId: selectedService,
              seats: allocation.seats
            })
          });

          const key = `${selectedDay}-${selectedService}-${allocation.tableId}`;
          // Add the guest ID allocation.seats times to represent seat count
          const guestEntries = Array(allocation.seats).fill(splittingGuest.id);
          setAssignments(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), ...guestEntries]
          }));
          
          // Update seat allocations tracking
          const allocKey = `${selectedDay}-${selectedService}-${splittingGuest.id}`;
          setSeatAllocations(prev => ({
            ...prev,
            [allocKey]: {
              ...(prev[allocKey] || {}),
              [allocation.tableId]: allocation.seats
            }
          }));
        }
      }

      setShowSplitGroup(false);
      setSplittingGuest(null);
      setSplitAllocations([]);
      setSelectedGuest(null);
      setQuickAssignMode(false);
      showNotification(`${splittingGuest.name}'s group split across ${splitAllocations.filter(a => a.seats > 0).length} tables`);
    } catch (error) {
      console.error('Error splitting group:', error);
      showNotification('Failed to split group', 'error');
    }
  };

  // Handle split group with individual member assignments
  const handleSplitGroupByMember = async () => {
    if (!splittingGuest || Object.keys(splitMemberAssignments).length === 0) return;
    
    // Check all members are assigned
    if (!Object.values(splitMemberAssignments).every(v => v !== null)) {
      showNotification('Please assign all group members to tables', 'error');
      return;
    }

    try {
      // First, remove any existing assignments for all group members in this service
      for (const guestIdStr of Object.keys(splitMemberAssignments)) {
        const guestId = parseInt(guestIdStr);
        const existingTables = getGuestTableAssignments(guestId, selectedService);
        for (const table of existingTables) {
          const key = `${selectedDay}-${selectedService}-${table.id}`;
          await fetch('/api/assignments', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              guestId, 
              tableId: table.id, 
              day: selectedDay, 
              serviceId: selectedService 
            })
          });
          
          setAssignments(prev => ({
            ...prev,
            [key]: (prev[key] || []).filter(id => id !== guestId)
          }));
        }
      }
      
      // Now create assignments for each member to their assigned table
      for (const [guestIdStr, tableId] of Object.entries(splitMemberAssignments)) {
        if (tableId === null) continue;
        
        const guestId = parseInt(guestIdStr);
        await fetch('/api/assignments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            guestId, 
            tableId, 
            day: selectedDay, 
            serviceId: selectedService,
            seats: 1
          })
        });

        const key = `${selectedDay}-${selectedService}-${tableId}`;
        setAssignments(prev => ({
          ...prev,
          [key]: [...(prev[key] || []), guestId]
        }));
      }

      // Count unique tables used
      const tablesUsed = new Set(Object.values(splitMemberAssignments).filter(v => v !== null));
      
      setShowSplitGroup(false);
      setSplittingGuest(null);
      setSplitAllocations([]);
      setSplitMemberAssignments({});
      setSelectedGuest(null);
      setQuickAssignMode(false);
      showNotification(`${splittingGuest.name}'s group split across ${tablesUsed.size} tables`);
    } catch (error) {
      console.error('Error splitting group:', error);
      showNotification('Failed to split group', 'error');
    }
  };

  const getTableCapacity = (tableId: number, serviceId: number, day = selectedDay) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return 0;
    
    const key = `${day}-${serviceId}`;
    const adjustment = chairAdjustments[key]?.[tableId] || 0;
    return table.capacity + adjustment;
  };

  const handleChairManagement = () => {
    if (!chairTargetTable) return;
    
    const totalChairsToAdd = tempChairAdjustments.reduce((sum, adj) => sum + Math.abs(adj.chairs), 0);
    if (totalChairsToAdd === 0) {
      showNotification('You must add at least one chair', 'error');
      return;
    }

    // Apply adjustments
    const key = `${selectedDay}-${selectedService}`;
    const newAdjustments = { ...chairAdjustments };
    
    if (!newAdjustments[key]) {
      newAdjustments[key] = {};
    }

    // Update target table (add chairs)
    newAdjustments[key][chairTargetTable.id] = (newAdjustments[key][chairTargetTable.id] || 0) + totalChairsToAdd;

    // Update source tables (remove chairs)
    tempChairAdjustments.forEach(adj => {
      if (adj.chairs < 0) {
        newAdjustments[key][adj.tableId] = (newAdjustments[key][adj.tableId] || 0) + adj.chairs;
      }
    });

    setChairAdjustments(newAdjustments);
    setShowChairManagement(false);
    setChairTargetTable(null);
    setTempChairAdjustments([]);
    showNotification(`Added ${totalChairsToAdd} chair${totalChairsToAdd > 1 ? 's' : ''} to ${chairTargetTable.name}`);
  };

  const exportAttendanceReport = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData: any[][] = [
      ['Weekly Attendance Report'],
      ['Generated on', new Date().toLocaleString()],
      [],
      ['Day', 'Service 1', 'Service 2', 'Service 3', 'Total Guests', 'Total Arrived', 'Arrival Rate']
    ];

    DAYS.forEach(day => {
      const row: any[] = [day.name];
      let dayTotal = 0;
      let dayArrived = 0;
      
      services.forEach(service => {
        const assignedGuestIds = Object.keys(assignments)
          .filter(k => k.startsWith(`${day.id}-${service.id}-`))
          .flatMap(k => assignments[k]);
        
        // Exclude ghosts from counts
        const nonGhostIds = assignedGuestIds.filter(id => {
          const guest = guests.find(g => g.id === id);
          return guest && !guest.isGhost;
        });
        
        const dayArrivals = arrivedGuests[day.id] || new Set();
        const arrived = nonGhostIds.filter(id => dayArrivals.has(id)).length;
        
        dayTotal += nonGhostIds.length;
        dayArrived += arrived;
        
        row.push(`${arrived}/${nonGhostIds.length}`);
      });
      
      row.push(dayTotal);
      row.push(dayArrived);
      row.push(dayTotal > 0 ? `${Math.round((dayArrived / dayTotal) * 100)}%` : '0%');
      
      summaryData.push(row);
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Detailed sheet for each day
    DAYS.forEach(day => {
      const dayData: any[][] = [
        [`${day.name} - Detailed Attendance`],
        [],
        ['Guest Name', 'Group Size', 'Service', 'Table', 'Arrived', 'Ghost', 'Notes']
      ];

      services.forEach(service => {
        Object.keys(assignments)
          .filter(k => k.startsWith(`${day.id}-${service.id}-`))
          .forEach(key => {
            const tableId = parseInt(key.split('-')[2]);
            const table = tables.find(t => t.id === tableId);
            const guestIds = assignments[key] || [];
            
            guestIds.forEach(guestId => {
              const guest = guests.find(g => g.id === guestId);
              if (guest) {
                const dayArrivals = arrivedGuests[day.id] || new Set();
                const arrived = dayArrivals.has(guestId) ? 'Yes' : 'No';
                const groupSize = getGuestTotalGroupSize(guestId);
                
                dayData.push([
                  guest.name,
                  groupSize,
                  service.name,
                  table?.name || 'Unknown',
                  arrived,
                  guest.isGhost ? 'Yes' : 'No',
                  guest.notes || ''
                ]);
              }
            });
          });
      });

      if (dayData.length > 3) {
        const daySheet = XLSX.utils.aoa_to_sheet(dayData);
        XLSX.utils.book_append_sheet(wb, daySheet, day.short);
      }
    });

    // Statistics sheet
    const statsData: any[][] = [
      ['Attendance Statistics'],
      [],
      ['Metric', 'Value'],
      ['Total Guests', guests.length],
      ['Total Tables', tables.length],
      ['Total Capacity', tables.reduce((sum, t) => sum + t.capacity, 0)],
      [],
      ['Service', 'Total Bookings'],
    ];

    services.forEach(service => {
      const total = DAYS.reduce((sum, day) => {
        const serviceAssignments = Object.keys(assignments)
          .filter(k => k.startsWith(`${day.id}-${service.id}-`))
          .flatMap(k => assignments[k]);
        return sum + serviceAssignments.length;
      }, 0);
      statsData.push([service.name, total]);
    });

    const statsSheet = XLSX.utils.aoa_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, statsSheet, 'Statistics');

    // Export
    const fileName = `attendance-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showNotification('Report exported successfully');
  };

  const exportDayReport = (dayId: string) => {
    const day = DAYS.find(d => d.id === dayId);
    if (!day) return;

    const wb = XLSX.utils.book_new();
    
    // Day summary
    const summaryData: any[][] = [
      [`${day.name} Attendance Report`],
      ['Generated on', new Date().toLocaleString()],
      [],
      ['Service', 'Total Guests', 'Arrived', 'Arrival Rate']
    ];

    services.forEach(service => {
      const assignedGuestIds = Object.keys(assignments)
        .filter(k => k.startsWith(`${dayId}-${service.id}-`))
        .flatMap(k => assignments[k]);
      
      // Exclude ghosts from counts
      const nonGhostIds = assignedGuestIds.filter(id => {
        const guest = guests.find(g => g.id === id);
        return guest && !guest.isGhost;
      });
      
      const dayArrivals = arrivedGuests[dayId] || new Set();
      const arrived = nonGhostIds.filter(id => dayArrivals.has(id)).length;
      const rate = nonGhostIds.length > 0 ? Math.round((arrived / nonGhostIds.length) * 100) : 0;
      
      summaryData.push([
        service.name,
        nonGhostIds.length,
        arrived,
        `${rate}%`
      ]);
    });

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Detailed attendance
    const detailData: any[][] = [
      [`${day.name} - Detailed Attendance`],
      [],
      ['Guest Name', 'Group Size', 'Service', 'Table', 'Arrived', 'Ghost', 'Notes']
    ];

    services.forEach(service => {
      Object.keys(assignments)
        .filter(k => k.startsWith(`${dayId}-${service.id}-`))
        .forEach(key => {
          const tableId = parseInt(key.split('-')[2]);
          const table = tables.find(t => t.id === tableId);
          const guestIds = assignments[key] || [];
          
          guestIds.forEach(guestId => {
            const guest = guests.find(g => g.id === guestId);
            if (guest) {
              const dayArrivals = arrivedGuests[dayId] || new Set();
              const arrived = dayArrivals.has(guestId) ? 'Yes' : 'No';
              const groupSize = getGuestTotalGroupSize(guestId);
              
              detailData.push([
                guest.name,
                groupSize,
                service.name,
                table?.name || 'Unknown',
                arrived,
                guest.isGhost ? 'Yes' : 'No',
                guest.notes || ''
              ]);
            }
          });
        });
    });

    const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
    XLSX.utils.book_append_sheet(wb, detailSheet, 'Details');

    // Export
    const fileName = `${day.name.toLowerCase()}-report-${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    showNotification(`${day.name} report exported`);
  };

  const currentService = services.find(s => s.id === selectedService)!;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading seating data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {notification.message}
        </div>
      )}

      <div className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">View Mode:</span>
              <div className="flex items-center bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('manager')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                    viewMode === 'manager'
                      ? 'bg-white text-gray-900'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Settings size={16} />
                  Manager
                </button>
                <button
                  onClick={() => setViewMode('waiter')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
                    viewMode === 'waiter'
                      ? 'bg-white text-gray-900'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Eye size={16} />
                  Waiter
                </button>
              </div>
            </div>
            {viewMode === 'manager' && (
              <button
                onClick={() => setShowRoomEditor(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                <LayoutGrid size={16} />
                Edit Room Layout
              </button>
            )}
          </div>
        </div>
      </div>

      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-red-700 p-2 rounded-lg">
                <Users className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Seating Manager</h1>
              </div>
            </div>
            {viewMode === 'manager' && (
              <div className="flex items-center gap-2">
                {lastRefresh && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 px-3 py-2 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Auto-sync: {lastRefresh.toLocaleTimeString()}</span>
                    <button
                      onClick={() => fetchData()}
                      className="text-gray-600 hover:text-gray-800 transition"
                      title="Refresh now"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowWeekOverview(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-red-50 text-red-800 hover:bg-red-200 rounded-lg transition"
                >
                  <Calendar size={16} />
                  Week Overview
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  <Upload size={16} />
                  Import
                </button>
                <button
                  onClick={() => setShowGuestForm(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-red-700 text-white hover:bg-red-800 rounded-lg transition"
                >
                  <Plus size={16} />
                  Add Guest
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-red-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2">
            {DAYS.map(day => (
              <button
                key={day.id}
                onClick={() => setSelectedDay(day.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                  selectedDay === day.id
                    ? 'bg-white text-red-700'
                    : 'text-red-50 hover:bg-red-700'
                }`}
              >
                {day.name}
              </button>
            ))}
            <div className="w-px bg-red-600 mx-2" />
            <button
              onClick={() => setSelectedDay('guests')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
                selectedDay === 'guests'
                  ? 'bg-white text-red-700'
                  : 'text-red-50 hover:bg-red-700'
              }`}
            >
              <Users size={16} />
              All Guests
            </button>
            <button
              onClick={() => setSelectedDay('summary')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition whitespace-nowrap flex items-center gap-2 ${
                selectedDay === 'summary'
                  ? 'bg-white text-red-700'
                  : 'text-red-50 hover:bg-red-700'
              }`}
            >
              <BarChart3 size={16} />
              Weekly Summary
            </button>
          </div>
        </div>
      </div>

      {selectedDay !== 'summary' && viewMode === 'manager' && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {services.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service.id)}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                      selectedService === service.id
                        ? `${service.textColor} border-current`
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    <Clock size={16} />
                    <span>{service.name}</span>
                    <span className="text-xs opacity-75">({service.time})</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowServiceSettings(true)}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                <Edit2 size={14} />
                Edit Times
              </button>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'waiter' && selectedDay !== 'summary' ? (
        <div className="max-w-7xl mx-auto">
          <WaiterView
            guests={guests}
            tables={tables}
            assignments={assignments}
            selectedDay={selectedDay}
            selectedService={selectedService}
            toggleArrival={toggleArrival}
            hasArrived={hasArrived}
            setSelectedService={setSelectedService}
            onReassignGuest={quickReassign}
            onReassignMultiple={reassignMultipleGuests}
            isTableBlocked={isTableBlocked}
            services={services}
            groups={groups}
            getGroupsAsLead={getGroupsAsLead}
            getGroupsAsMember={getGroupsAsMember}
            hasDeparted={hasDeparted}
            toggleDeparture={toggleDeparture}
            departedGuests={departedGuests}
          />
        </div>
      ) : selectedDay === 'guests' ? (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-gray-900 text-lg mb-4">
                All Guests
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({guests.length} total)
                </span>
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search guests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                </div>
                
                {/* Filter */}
                <select
                  value={guestFilter}
                  onChange={(e) => setGuestFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}
                  className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                >
                  <option value="all">All Guests</option>
                  <option value="assigned">Assigned Only</option>
                  <option value="unassigned">Unassigned Only</option>
                </select>
                
                {/* Sort */}
                <select
                  value={guestSort}
                  onChange={(e) => setGuestSort(e.target.value as 'name' | 'size')}
                  className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                >
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Group Size</option>
                </select>
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {guests
                  .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .filter(g => {
                    if (guestFilter === 'all') return true;
                    
                    // Check if guest is assigned to any service on any day
                    const isAssigned = DAYS.some(day => 
                      services.some(service => {
                        const assignedTable = getAssignedTable(g.id, service.id, day.id);
                        return assignedTable !== null;
                      })
                    );
                    
                    if (guestFilter === 'assigned') return isAssigned;
                    if (guestFilter === 'unassigned') return !isAssigned;
                    return true;
                  })
                  .sort((a, b) => {
                    if (guestSort === 'name') {
                      return a.name.localeCompare(b.name);
                    } else {
                      return getGuestTotalGroupSize(b.id) - getGuestTotalGroupSize(a.id);
                    }
                  })
                  .map(guest => {
                    // Get all assignments for this guest
                    const allAssignments: {day: string, service: number, table: Table}[] = [];
                    DAYS.forEach(day => {
                      services.forEach(service => {
                        const table = getAssignedTable(guest.id, service.id, day.id);
                        if (table) {
                          allAssignments.push({
                            day: day.short,
                            service: service.id,
                            table
                          });
                        }
                      });
                    });
                    
                    const isDuplicate = isDuplicateGuest(guest);
                    const groupSize = getGuestTotalGroupSize(guest.id);
                    
                    // Check if guest has arrived on any day
                    const hasArrivedAnyDay = DAYS.some(day => {
                      const dayKey = day.id;
                      return arrivedGuests[dayKey]?.has(guest.id);
                    });
                    
                    return (
                      <div
                        key={guest.id}
                        className="p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{guest.name}</h3>
                              {guest.isManuallyAdded && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium" title="Added manually after import">
                                  + Added
                                </span>
                              )}
                              {guest.isGhost && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full font-medium">
                                  Ghost
                                </span>
                              )}
                              {isDuplicate && (
                                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium" title="Duplicate name detected">
                                  ⚠️ Duplicate
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{getGroupSizeText(groupSize)}</p>
                            {guest.notes && (
                              <p className="text-xs text-gray-500 italic mt-1">{guest.notes}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingGuest(guest);
                                setShowEditGuest(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition"
                              title="Edit guest"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteGuest(guest.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                              title="Delete guest"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        {allAssignments.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-700">Assignments:</p>
                            {allAssignments.map((assignment, idx) => {
                              // Check if guest has arrived for this specific day
                              const dayKey = DAYS.find(d => d.short === assignment.day)?.id;
                              const arrivedThisDay = dayKey && arrivedGuests[dayKey]?.has(guest.id);
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`text-xs px-2 py-1 rounded ${
                                    arrivedThisDay 
                                      ? 'bg-green-50 text-green-700' 
                                      : 'bg-blue-50 text-blue-700'
                                  }`}
                                >
                                  {assignment.day} • {services.find(s => s.id === assignment.service)?.name} • {assignment.table.name}
                                  {arrivedThisDay && ' ✓'}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                            Not assigned
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              
              {guests
                .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .filter(g => {
                  if (guestFilter === 'all') return true;
                  const isAssigned = DAYS.some(day => 
                    services.some(service => {
                      const assignedTable = getAssignedTable(g.id, service.id, day.id);
                      return assignedTable !== null;
                    })
                  );
                  if (guestFilter === 'assigned') return isAssigned;
                  if (guestFilter === 'unassigned') return !isAssigned;
                  return true;
                }).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Users size={48} className="mx-auto mb-3 opacity-20" />
                  <p>No guests found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : selectedDay === 'summary' ? (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <WeeklySummary 
            guests={guests}
            assignments={assignments}
            arrivedGuests={arrivedGuests}
            tables={tables}
            services={services}
            onExportDay={exportDayReport}
            onExportWeek={exportAttendanceReport}
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className={`grid grid-cols-1 gap-6 ${guestListCollapsed ? 'lg:grid-cols-1' : 'lg:grid-cols-3'}`}>
            {!guestListCollapsed && (
              <div className="bg-white rounded-xl shadow-sm border">
                {/* Tabs */}
                <div className="border-b">
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab('guests')}
                      className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                        activeTab === 'guests'
                          ? 'border-red-700 text-red-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Guests ({guests.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('groups')}
                      className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${
                        activeTab === 'groups'
                          ? 'border-red-700 text-red-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Groups ({groups.length})
                    </button>
                  </div>
                </div>

                {/* Groups Tab Content */}
                {activeTab === 'groups' && (
                  <>
                    <div className="p-4 border-b">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="font-semibold text-gray-900">Groups</h2>
                        <button
                          onClick={() => setShowGroupForm(true)}
                          className="flex items-center gap-1 text-xs text-red-700 hover:text-red-800"
                        >
                          <Plus size={14} />
                          New Group
                        </button>
                      </div>
                      
                      {/* Group Search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                          type="text"
                          placeholder="Search groups..."
                          value={groupSearchTerm}
                          onChange={(e) => setGroupSearchTerm(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                        />
                      </div>
                    </div>
                    
                    <div className="p-2 overflow-y-auto" style={{maxHeight: 'calc(100vh - 380px)'}}>
                      {groups
                        .filter(g => 
                          g.leadGuestName?.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
                          g.name?.toLowerCase().includes(groupSearchTerm.toLowerCase()) ||
                          g.members.some(m => m.guestName?.toLowerCase().includes(groupSearchTerm.toLowerCase()))
                        )
                        .map(group => {
                          const groupSize = getGroupSize(group);
                          const isAssigned = getAssignedTable(group.leadGuestId, selectedService);
                          const assignmentStatus = getGroupAssignmentStatus(group.id, selectedService);
                          // Only show as partial if this group is actively being used for this service
                          const hasPartialAssignment = assignmentStatus.isActiveForService && 
                            assignmentStatus.assignedCount > 0 && !assignmentStatus.isComplete;
                          // Group is fully assigned if active and complete
                          const isFullyAssigned = assignmentStatus.isActiveForService && assignmentStatus.isComplete;
                          
                          return (
                            <div
                              key={group.id}
                              onClick={() => {
                                if (!isFullyAssigned && !hasPartialAssignment) {
                                  const leadGuest = guests.find(g => g.id === group.leadGuestId);
                                  if (leadGuest) {
                                    setSelectedGuest(leadGuest);
                                    setQuickAssignMode(true);
                                  }
                                }
                              }}
                              className={`p-3 rounded-lg mb-2 border transition cursor-pointer ${
                                hasPartialAssignment
                                  ? 'bg-orange-50 border-orange-300'
                                  : isFullyAssigned 
                                  ? 'bg-blue-50 border-blue-200' 
                                  : selectedGuest?.id === group.leadGuestId && quickAssignMode
                                  ? 'bg-red-50 border-red-300 ring-2 ring-red-300'
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <Users size={14} className="text-gray-400" />
                                    <span className="font-medium text-gray-900 text-sm truncate">
                                      {group.name || `${group.leadGuestName}'s Group`}
                                    </span>
                                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                                      {groupSize} {groupSize === 1 ? 'person' : 'people'}
                                    </span>
                                    {hasPartialAssignment && (
                                      <span className="text-xs px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded-full flex items-center gap-1">
                                        <AlertCircle size={10} />
                                        {assignmentStatus.assignedCount}/{assignmentStatus.totalCount} assigned
                                      </span>
                                    )}
                                    {assignmentStatus.isSplit && (
                                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                        Split
                                      </span>
                                    )}
                                    {selectedGuest?.id === group.leadGuestId && quickAssignMode && (
                                      <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">
                                        Click a table to assign
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="text-xs text-gray-500 space-y-0.5">
                                    <div className="flex items-center gap-1">
                                      <span className="font-medium">Lead:</span>
                                      <span className={group.leadIsGhost ? 'text-purple-600' : ''}>
                                        {group.leadGuestName}
                                        {group.leadIsGhost && ' (Ghost)'}
                                      </span>
                                    </div>
                                    {group.members.length > 0 && (
                                      <div className="flex items-center gap-1 flex-wrap">
                                        <span className="font-medium">Members:</span>
                                        <span className="truncate">
                                          {group.members.slice(0, 3).map(m => m.guestName).join(', ')}
                                          {group.members.length > 3 && ` +${group.members.length - 3} more`}
                                        </span>
                                      </div>
                                    )}
                                    {isFullyAssigned && (
                                      <div className="flex items-center gap-1 text-blue-600">
                                        <MapPin size={10} />
                                        <span>{tables.find(t => t.id === assignmentStatus.tableIds[0])?.name}</span>
                                      </div>
                                    )}
                                    {hasPartialAssignment && assignmentStatus.missingMembers.length > 0 && (
                                      <div className="flex items-center gap-1 text-orange-600">
                                        <AlertCircle size={10} />
                                        <span>Missing: {assignmentStatus.missingMembers.map(g => g.name).join(', ')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingGroup(group);
                                      setEditingGroupName(group.name || '');
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition"
                                    title="Edit group"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteGroup(group.id);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                                    title="Delete group"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                              
                              {/* Assign missing members button */}
                              {hasPartialAssignment && assignmentStatus.missingMembers.length > 0 && (
                                <div className="mt-2 flex gap-2">
                                  {assignmentStatus.tableIds.length === 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // Assign missing members to the same table
                                        const tableId = assignmentStatus.tableIds[0];
                                        assignmentStatus.missingMembers.forEach(async (g) => {
                                          await assignGuest(g.id, tableId, selectedService, true);
                                        });
                                        const table = tables.find(t => t.id === tableId);
                                        showNotification(`Missing members assigned to ${table?.name}`);
                                      }}
                                      className="flex-1 text-xs py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded transition flex items-center justify-center gap-1"
                                    >
                                      <Plus size={12} />
                                      Add missing to {tables.find(t => t.id === assignmentStatus.tableIds[0])?.name}
                                    </button>
                                  )}
                                  {assignmentStatus.isSplit && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const leadGuest = guests.find(g => g.id === group.leadGuestId);
                                        if (leadGuest) {
                                          setSplittingGuest(leadGuest);
                                          // Initialize with current assignments
                                          const memberAssignments: Record<number, number | null> = {};
                                          const allMemberIds = [group.leadGuestId, ...group.members.map(m => m.guestId)];
                                          allMemberIds.forEach(guestId => {
                                            const table = getAssignedTable(guestId, selectedService);
                                            memberAssignments[guestId] = table?.id || null;
                                          });
                                          setSplitMemberAssignments(memberAssignments);
                                          
                                          const availableTables = tables
                                            .filter(t => !isTableBlocked(t.id, selectedService))
                                            .map(t => ({
                                              tableId: t.id,
                                              seats: 0,
                                              available: t.capacity - getTableOccupancy(t.id, selectedService)
                                            }))
                                            .filter(t => t.available > 0 || assignmentStatus.tableIds.includes(t.tableId));
                                          setSplitAllocations(availableTables);
                                          setShowSplitGroup(true);
                                        }
                                      }}
                                      className="flex-1 text-xs py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded transition flex items-center justify-center gap-1"
                                    >
                                      <Edit2 size={12} />
                                      Edit split
                                    </button>
                                  )}
                                </div>
                              )}
                              
                              {/* Split button for groups too large */}
                              {!isAssigned && !hasPartialAssignment && needsSplit(group.leadGuestId, selectedService) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const leadGuest = guests.find(g => g.id === group.leadGuestId);
                                    if (leadGuest) {
                                      setSplittingGuest(leadGuest);
                                      
                                      // Initialize split with all group members unassigned
                                      const memberAssignments: Record<number, number | null> = { [group.leadGuestId]: null };
                                      group.members.forEach(member => {
                                        memberAssignments[member.guestId] = null;
                                      });
                                      setSplitMemberAssignments(memberAssignments);
                                      
                                      const availableTables = tables
                                        .filter(t => !isTableBlocked(t.id, selectedService))
                                        .map(t => ({
                                          tableId: t.id,
                                          seats: 0,
                                          available: t.capacity - getTableOccupancy(t.id, selectedService)
                                        }))
                                        .filter(t => t.available > 0);
                                      setSplitAllocations(availableTables);
                                      setShowSplitGroup(true);
                                    }
                                  }}
                                  className="mt-2 w-full text-xs py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded transition flex items-center justify-center gap-1"
                                >
                                  <AlertCircle size={12} />
                                  Split Group (too large for single table)
                                </button>
                              )}
                            </div>
                          );
                        })}
                      
                      {groups.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          <Users size={32} className="mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No groups yet</p>
                          <p className="text-xs mt-1">Create a group to seat multiple guests together</p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Guests Tab Content */}
                {activeTab === 'guests' && (
                  <>
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-semibold text-gray-900">
                      All Guests
                    </h2>
                  {quickAssignMode && (
                    <button
                      onClick={() => {
                        setQuickAssignMode(false);
                        setSelectedGuest(null);
                      }}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                
                {/* Search */}
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search guests..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                </div>
                
                {/* Filter and Sort */}
                <div className="flex gap-2">
                  <select
                    value={guestFilter}
                    onChange={(e) => setGuestFilter(e.target.value as 'all' | 'assigned' | 'unassigned')}
                    className="flex-1 px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  >
                    <option value="all">All Guests</option>
                    <option value="assigned">Assigned to {currentService?.name || 'Service'}</option>
                    <option value="unassigned">Not Assigned</option>
                  </select>
                  
                  <select
                    value={guestSort}
                    onChange={(e) => setGuestSort(e.target.value as 'name' | 'size')}
                    className="flex-1 px-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  >
                    <option value="name">By Name</option>
                    <option value="size">By Group Size</option>
                  </select>
                </div>
              </div>
              <div className="p-2 overflow-y-auto" style={{maxHeight: 'calc(100vh - 380px)'}}>
                {guests
                  .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .filter(g => {
                    if (guestFilter === 'all') return true;
                    const assignedTable = getAssignedTable(g.id, selectedService);
                    if (guestFilter === 'assigned') return assignedTable !== null;
                    if (guestFilter === 'unassigned') return assignedTable === null;
                    return true;
                  })
                  .sort((a, b) => {
                    if (guestSort === 'name') {
                      return a.name.localeCompare(b.name);
                    } else {
                      return getGuestTotalGroupSize(b.id) - getGuestTotalGroupSize(a.id);
                    }
                  })
                  .map(guest => {
                    const assignedTable = getAssignedTable(guest.id, selectedService);
                    const assignedTables = getGuestTableAssignments(guest.id, selectedService);
                    const isSplit = assignedTables.length > 1;
                    const isDuplicate = isDuplicateGuest(guest);
                    const arrived = hasArrived(guest.id);
                    const members = groupMembers[guest.id] || [];
                    const hasMembers = members.length > 0;
                    const arrivalStatus = getArrivalStatus(guest);
                    const isGhost = guest.isGhost;
                    const ledGroups = getGroupsAsLead(guest.id);
                    const memberOfGroups = getGroupsAsMember(guest.id);
                    const groupSize = getGuestTotalGroupSize(guest.id);
                    
                    return (
                      <div
                        key={guest.id}
                        className={`p-2.5 rounded-lg mb-1.5 cursor-pointer transition ${
                          isGhost
                            ? 'bg-purple-50 border border-dashed border-purple-300 hover:bg-purple-100'
                            : selectedGuest?.id === guest.id
                            ? `${currentService.lightColor} ring-2 ring-current ${currentService.textColor}`
                            : arrivalStatus.isComplete

                            ? 'bg-green-50 border border-green-200 hover:bg-green-100'
                            : arrivalStatus.isPartial
                            ? 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
                            : assignedTable || isSplit
                            ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                            : 'hover:bg-gray-50 border border-gray-100'
                        }`}
                        onClick={() => {
                          setSelectedGuest(guest);
                          setQuickAssignMode(true);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              {isGhost && (
                                <Ghost size={14} className="text-purple-500" />
                              )}
                              {!isGhost && arrivalStatus.arrived > 0 && (
                                <span className={`w-2 h-2 rounded-full ${
                                  arrivalStatus.isComplete ? 'bg-green-500' : 'bg-yellow-500'
                                }`} title={`${arrivalStatus.arrived}/${arrivalStatus.total} arrived`}></span>
                              )}
                              <p className={`font-semibold text-sm truncate ${isGhost ? 'text-purple-700' : 'text-gray-900'}`}>
                                {guest.name}
                              </p>
                              {guest.isManuallyAdded && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium whitespace-nowrap" title="Added manually after import">
                                  + Added
                                </span>
                              )}
                              {isGhost && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full font-medium whitespace-nowrap">
                                  Ghost
                                </span>
                              )}
                              {hasMembers && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                  arrivalStatus.isComplete 
                                    ? 'bg-green-100 text-green-700' 
                                    : arrivalStatus.isPartial
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {arrivalStatus.arrived}/{arrivalStatus.total} people
                                </span>
                              )}
                              {isDuplicate && (
                                <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-medium whitespace-nowrap" title="Duplicate name detected">
                                  ⚠️ Duplicate
                                </span>
                              )}
                              {isSplit ? (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium whitespace-nowrap">
                                  Split: {assignedTables.map(t => {
                                    const allocKey = `${selectedDay}-${selectedService}-${guest.id}`;
                                    const seats = seatAllocations[allocKey]?.[t.id] || 0;
                                    return `${t.name}(${seats})`;
                                  }).join(', ')}
                                </span>
                              ) : assignedTable && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium whitespace-nowrap">
                                  {assignedTable.name} • S{selectedService}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              {ledGroups.length > 0 && (
                                <span className="text-blue-600 truncate max-w-[150px]">
                                  Leads {ledGroups.length} group{ledGroups.length > 1 ? 's' : ''}
                                </span>
                              )}
                              {memberOfGroups.length > 0 && (
                                <>
                                  {ledGroups.length > 0 && <span className="text-gray-300">•</span>}
                                  <span className="text-gray-500 truncate max-w-[150px]">
                                    Member of {memberOfGroups.length} group{memberOfGroups.length > 1 ? 's' : ''}
                                  </span>
                                </>
                              )}
                              {guest.notes && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-gray-500 italic truncate">{guest.notes}</span>
                                </>
                              )}
                            </div>
                            {!assignedTable && !canFitInSingleTable(guest.id, selectedService) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSplittingGuest(guest);
                                  
                                  // Initialize split with all group members unassigned
                                  const ledGroups = getGroupsAsLead(guest.id);
                                  const memberAssignments: Record<number, number | null> = { [guest.id]: null };
                                  ledGroups.forEach(group => {
                                    group.members.forEach(member => {
                                      memberAssignments[member.guestId] = null;
                                    });
                                  });
                                  setSplitMemberAssignments(memberAssignments);
                                  
                                  // Initialize split allocations with available tables
                                  const availableTables = tables
                                    .filter(t => !isTableBlocked(t.id, selectedService))
                                    .map(t => ({
                                      tableId: t.id,
                                      seats: 0,
                                      available: t.capacity - getTableOccupancy(t.id, selectedService)
                                    }))
                                    .filter(t => t.available > 0);
                                  setSplitAllocations(availableTables);
                                  setShowSplitGroup(true);
                                }}
                                className="mt-1.5 text-xs px-2 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded transition inline-flex items-center gap-1"
                              >
                                <AlertCircle size={12} />
                                Split Group (no single table fits)
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {quickAssignMode && selectedGuest?.id === guest.id && (
                              <span className="text-xs px-2 py-1 bg-red-50 text-red-800 rounded mr-1 whitespace-nowrap">
                                Select table →
                              </span>
                            )}
                            {isSplit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSplitEditMode(guest, selectedService);
                                }}
                                className="p-1.5 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded transition"
                                title="Edit split allocation"
                              >
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingGuest(guest);
                                setShowEditGuest(true);
                              }}
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition"
                              title="Edit guest & manage members"
                            >
                              <Edit2 size={14} />
                            </button>
                            {(groupMembers[guest.id]?.length || 0) > 0 && (
                              <span className="p-1.5 text-blue-500" title={`${(groupMembers[guest.id]?.length || 0) + 1} people in group`}>
                                <Users size={14} />
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleGhost(guest.id);
                              }}
                              className={`p-1.5 rounded transition ${
                                guest.isGhost 
                                  ? 'text-purple-600 bg-purple-100 hover:bg-purple-200' 
                                  : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
                              }`}
                              title={guest.isGhost ? 'Include in final count' : 'Mark as ghost (exclude from count)'}
                            >
                              <Ghost size={14} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteGuest(guest.id);
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition"
                              title="Delete guest"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                {guests.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No guests added yet
                  </p>
                )}
              </div>
                  </>
                )}
            </div>
            )}

            <div className={guestListCollapsed ? '' : 'lg:col-span-2'}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {guestListCollapsed && (
                    <button
                      onClick={() => setGuestListCollapsed(false)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition"
                      title="Show guest list"
                    >
                      <Users size={16} />
                      Show Guests
                    </button>
                  )}
                  {!guestListCollapsed && (
                    <button
                      onClick={() => setGuestListCollapsed(true)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                      title="Hide guest list"
                    >
                      <X size={16} />
                      Hide Guests
                    </button>
                  )}
                  <h2 className="font-semibold text-gray-900">
                    Tables - {currentService.name}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {reassignGuest && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg text-sm">
                      <span>
                        Moving: <strong>
                          {reassignGuest.moveWholeGroup 
                            ? (() => {
                                const group = groups.find(g => g.id === reassignGuest.groupId);
                                return group?.name || `${reassignGuest.guest.name}'s group`;
                              })()
                            : reassignGuest.guest.name
                          }
                        </strong>
                        {reassignGuest.moveWholeGroup && (
                          <span className="text-xs ml-1">
                            ({groups.find(g => g.id === reassignGuest.groupId) ? getGroupSize(groups.find(g => g.id === reassignGuest.groupId)!) : 1} people)
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => setReassignGuest(null)}
                        className="text-orange-500 hover:text-orange-700"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowTableForm(true)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  >
                    <Plus size={14} />
                    Add Table
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tables.map(table => {
                  const capacity = getTableCapacity(table.id, selectedService);
                  const occupancy = getTableOccupancy(table.id, selectedService);
                  const assignedGuestIds = assignments[`${selectedDay}-${selectedService}-${table.id}`] || [];
                  const assignedGuests = assignedGuestIds.map(id => guests.find(g => g.id === id)).filter(Boolean) as Guest[];
                  const isFull = occupancy >= capacity;
                  const isBlocked = isTableBlocked(table.id, selectedService);
                  const chairAdjustment = chairAdjustments[`${selectedDay}-${selectedService}`]?.[table.id] || 0;
                  const selectedGuestSize = selectedGuest ? getGuestTotalGroupSize(selectedGuest.id) : 0;
                  const canAssign = quickAssignMode && selectedGuest && !isFull && !isBlocked &&
                    (occupancy + selectedGuestSize <= capacity);
                  
                  // For group movement, calculate proper size
                  let reassignGuestSize = 0;
                  if (reassignGuest) {
                    if (reassignGuest.moveWholeGroup && reassignGuest.groupId) {
                      const group = groups.find(g => g.id === reassignGuest.groupId);
                      reassignGuestSize = group ? getGroupSize(group) : 1;
                    } else {
                      reassignGuestSize = 1; // Moving individual
                    }
                  }
                  const canReassign = reassignGuest && 
                    reassignGuest.fromTableId !== table.id && 
                    !isBlocked &&
                    (occupancy + reassignGuestSize <= capacity);

                  const canMultiReassign = reassignGuests &&
                    reassignGuests.fromTableId !== table.id &&
                    reassignGuests.guests.length > 0 &&
                    !isBlocked;

                  return (
                    <div
                      key={table.id}
                      onClick={() => {
                        if (canAssign) {
                          assignGuest(selectedGuest!.id, table.id, selectedService);
                        } else if (canReassign) {
                          if (reassignGuest.moveWholeGroup && reassignGuest.groupId) {
                            quickReassignGroup(reassignGuest.guest.id, reassignGuest.groupId, table.id, selectedService);
                          } else {
                            quickReassign(reassignGuest.guest.id, reassignGuest.fromTableId, table.id, selectedService);
                          }
                        } else if (canMultiReassign) {
                          const guestIds = reassignGuests.guests.map(g => g.id);
                          reassignMultipleGuests(guestIds, reassignGuests.fromTableId, table.id, selectedService);
                        }
                      }}
                      className={`bg-white rounded-xl shadow-sm border p-4 transition ${
                        isBlocked
                          ? 'opacity-50 bg-gray-100 border-red-300'
                          : canAssign
                          ? `cursor-pointer ring-2 ${currentService.textColor} ring-current ${currentService.lightColor}`
                          : canReassign
                          ? 'cursor-pointer ring-2 ring-orange-400 bg-orange-50'
                          : canMultiReassign
                          ? 'cursor-pointer ring-2 ring-blue-400 bg-blue-50'
                          : quickAssignMode && selectedGuest
                          ? 'opacity-50'
                          : reassignGuest
                          ? reassignGuest.fromTableId === table.id ? 'ring-2 ring-orange-400' : 'opacity-50'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{table.name}</h3>
                          {chairAdjustment !== 0 && (
                            <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              chairAdjustment > 0 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {chairAdjustment > 0 ? '+' : ''}{chairAdjustment} chair{Math.abs(chairAdjustment) !== 1 ? 's' : ''}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const key = `${selectedDay}-${selectedService}`;
                                  const newAdjustments = { ...chairAdjustments };
                                  
                                  if (newAdjustments[key]) {
                                    // If removing a positive adjustment, clear all related negative adjustments
                                    if (chairAdjustment > 0) {
                                      const chairsToReturn = chairAdjustment;
                                      // Find tables with negative adjustments and clear them
                                      Object.keys(newAdjustments[key]).forEach(tableIdStr => {
                                        const tid = parseInt(tableIdStr);
                                        if (newAdjustments[key][tid] < 0) {
                                          delete newAdjustments[key][tid];
                                        }
                                      });
                                    }
                                    // If removing a negative adjustment, find and remove corresponding positive adjustment
                                    else if (chairAdjustment < 0) {
                                      // Find the table with positive adjustment
                                      Object.keys(newAdjustments[key]).forEach(tableIdStr => {
                                        const tid = parseInt(tableIdStr);
                                        if (newAdjustments[key][tid] > 0) {
                                          delete newAdjustments[key][tid];
                                        }
                                      });
                                    }
                                    
                                    // Remove this table's adjustment
                                    delete newAdjustments[key][table.id];
                                    
                                    // Clean up empty keys
                                    if (Object.keys(newAdjustments[key]).length === 0) {
                                      delete newAdjustments[key];
                                    }
                                  }
                                  
                                  setChairAdjustments(newAdjustments);
                                  showNotification('Chair adjustments removed');
                                }}
                                className="hover:bg-blue-200 hover:bg-orange-200 rounded-full p-0.5 transition"
                                title="Remove chair adjustment"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          )}
                          {isBlocked && (
                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                              Blocked
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChairTargetTable(table);
                              setTempChairAdjustments([]);
                              setShowChairManagement(true);
                            }}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded transition"
                            title="Manage chairs"
                          >
                            + Chairs
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleBlockTable(table.id, selectedService);
                            }}
                            className={`px-2 py-1 text-xs rounded transition ${
                              isBlocked 
                                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                                : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600'
                            }`}
                            title={isBlocked ? 'Unblock table' : 'Block table'}
                          >
                            {isBlocked ? 'Unblock' : 'Block'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTable(table.id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 transition"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isBlocked
                              ? 'bg-red-100 text-red-700'
                              : isFull
                              ? 'bg-red-100 text-red-700'
                              : occupancy > 0
                              ? `${currentService.lightColor} ${currentService.textColor}`
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {occupancy}/{capacity}
                          </span>
                          {canAssign && (
                            <span className="text-xs text-green-600 font-medium">+ Assign</span>
                          )}
                          {canReassign && (
                            <span className="text-xs text-orange-600 font-medium">→ Move here</span>
                          )}
                          {assignedGuests.length > 1 && !reassignGuest && !reassignGuests && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Pre-select all guests at this table
                                setReassignGuests({ guests: [...assignedGuests], fromTableId: table.id, serviceId: selectedService });
                              }}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded transition"
                              title="Select multiple guests to move"
                            >
                              Select Multiple
                            </button>
                          )}
                          {reassignGuests?.fromTableId === table.id && reassignGuests.guests.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Will be handled by clicking another table
                              }}
                              className="text-xs px-2 py-1 bg-orange-100 text-orange-600 rounded font-medium"
                            >
                              {reassignGuests.guests.length} selected → Click table
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isFull ? 'bg-red-500' : currentService.color
                          }`}
                          style={{ width: `${(occupancy / capacity) * 100}%` }}
                        />
                      </div>

                      <div className="space-y-2">
                        {(() => {
                          const groupedGuests = getTableGuestsGrouped(table.id, selectedService);
                          const isInMultiSelect = reassignGuests?.fromTableId === table.id;
                          
                          return groupedGuests.map((groupData, groupIndex) => {
                            const hasGroup = groupData.groupId !== null;
                            const groupStatus = hasGroup ? getGroupAssignmentStatus(groupData.groupId!, selectedService) : null;
                            const isIncomplete = groupStatus && !groupStatus.isComplete;
                            
                            // Get group color based on groupId for visual distinction
                            const groupColors = [
                              'border-blue-400 bg-blue-50/30',
                              'border-purple-400 bg-purple-50/30',
                              'border-teal-400 bg-teal-50/30',
                              'border-amber-400 bg-amber-50/30',
                              'border-pink-400 bg-pink-50/30',
                            ];
                            const groupColorClass = hasGroup ? groupColors[groupData.groupId! % groupColors.length] : '';
                            
                            return (
                              <div key={groupData.groupId ?? 'ungrouped'} className={`${hasGroup ? `border-l-4 rounded-lg ${groupColorClass} pl-2 py-1` : ''}`}>
                                {hasGroup && (
                                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1 px-1">
                                    <div className="flex items-center gap-1">
                                      <Users size={10} />
                                      <span>{groupData.groupName}</span>
                                    </div>
                                    {isIncomplete && (
                                      <span className="flex items-center gap-1 text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                        <AlertCircle size={10} />
                                        {groupStatus!.assignedCount}/{groupStatus!.totalCount}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <div className="space-y-1">
                                  {groupData.guests.map(guest => {
                                    const isSelected = reassignGuests?.guests.some(g => g.id === guest.id);
                                    
                                    return (
                                      <div
                                        key={guest.id}
                                        className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${
                                          hasArrived(guest.id) ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                                        } ${reassignGuest?.guest.id === guest.id ? 'ring-2 ring-orange-400' : ''} ${
                                          isSelected ? 'ring-2 ring-blue-400' : ''
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          {isInMultiSelect ? (
                                            <input
                                              type="checkbox"
                                              checked={isSelected || false}
                                              onChange={(e) => {
                                                e.stopPropagation();
                                                if (reassignGuests) {
                                                  const newGuests = isSelected
                                                    ? reassignGuests.guests.filter(g => g.id !== guest.id)
                                                    : [...reassignGuests.guests, guest];
                                                  setReassignGuests({ ...reassignGuests, guests: newGuests });
                                                }
                                              }}
                                              className="w-4 h-4 text-blue-600 rounded"
                                            />
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleArrival(guest.id);
                                              }}
                                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                                                hasArrived(guest.id)
                                                  ? 'bg-green-500 border-green-500 text-white'
                                                  : 'border-gray-300 hover:border-green-400'
                                              }`}
                                              title={hasArrived(guest.id) ? 'Mark as not arrived' : 'Mark as arrived'}
                                            >
                                              {hasArrived(guest.id) && <Check size={12} />}
                                            </button>
                                          )}
                                          <div className="flex items-center gap-1">
                                            <span className={`font-medium ${hasArrived(guest.id) ? 'text-green-700' : ''}`}>
                                              {guest.name}
                                            </span>
                                            {guest.isManuallyAdded && (
                                              <span className="text-xs text-blue-500" title="Added manually">+</span>
                                            )}
                                            {guest.isGhost && (
                                              <Ghost size={12} className="text-purple-500" />
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          {!isInMultiSelect && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (reassignGuest?.guest.id === guest.id) {
                                                    setReassignGuest(null);
                                                  } else {
                                                    // Check if guest is a leader of any group
                                                    const ledGroups = getGroupsAsLead(guest.id);
                                                    if (ledGroups.length > 0) {
                                                      // Show group action popup for leader
                                                      setGroupMemberAction({
                                                        guest,
                                                        tableId: table.id,
                                                        groupId: ledGroups[0].id,
                                                        leadGuestId: guest.id,
                                                        isMove: true,
                                                        fromTableId: table.id
                                                      });
                                                    } else {
                                                      // Check if guest is a member of any group (not leader)
                                                      const memberOfGroups = getGroupsAsMember(guest.id);
                                                      if (memberOfGroups.length > 0) {
                                                        // Show confirmation popup
                                                        setGroupMemberAction({
                                                          guest,
                                                          tableId: table.id,
                                                          groupId: memberOfGroups[0].id,
                                                          leadGuestId: memberOfGroups[0].leadGuestId,
                                                          isMove: true,
                                                          fromTableId: table.id
                                                        });
                                                      } else {
                                                        setReassignGuest({ guest, fromTableId: table.id, serviceId: selectedService });
                                                        setSelectedGuest(null);
                                                        setQuickAssignMode(false);
                                                      }
                                                    }
                                                  }
                                                }}
                                                className={`p-1 transition ${
                                                  reassignGuest?.guest.id === guest.id
                                                    ? 'text-orange-500'
                                                    : 'text-gray-400 hover:text-orange-500'
                                                }`}
                                                title="Move to another table"
                                              >
                                                <ArrowRight size={14} />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  unassignGuest(guest.id, table.id, selectedService);
                                                }}
                                                className="p-1 text-gray-400 hover:text-red-500 transition"
                                              >
                                                <X size={14} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                        {assignedGuests.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-2">No guests assigned</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-xl shadow-sm border p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              {DAYS.find(d => d.id === selectedDay)?.name} Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {services.map(service => {
                const assignedGuestIds = Object.keys(assignments)
                  .filter(k => k.startsWith(`${selectedDay}-${service.id}-`))
                  .flatMap(k => assignments[k]);
                const totalAssigned = assignedGuestIds.length;
                const dayArrivals = arrivedGuests[selectedDay] || new Set();
                const totalArrived = assignedGuestIds.filter(id => dayArrivals.has(id)).length;
                const totalSeats = tables.reduce((sum, t) => {
                  const occ = getTableOccupancy(t.id, service.id);
                  return sum + occ;
                }, 0);
                const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

                return (
                  <div key={service.id} className={`${service.lightColor} rounded-lg p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${service.color}`} />
                      <span className={`font-medium ${service.textColor}`}>{service.name}</span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {totalAssigned} guests assigned • {totalSeats}/{totalCapacity} seats
                    </p>
                    <p className="text-sm text-green-600 font-medium mt-1">
                      ✓ {totalArrived}/{totalAssigned} arrived
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showGuestForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Add New Guest</h3>
              <button onClick={() => setShowGuestForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={newGuest.name}
                  onChange={(e) => setNewGuest({ ...newGuest, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  placeholder="Guest name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={newGuest.notes}
                  onChange={(e) => setNewGuest({ ...newGuest, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  placeholder="Dietary restrictions, VIP, etc."
                />
              </div>
              <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                💡 Tip: To create a group, first add all guests individually, then use the Groups tab to link them together.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Service (optional)</label>
                <select
                  value={newGuest.assignedService || ''}
                  onChange={(e) => setNewGuest({ ...newGuest, assignedService: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                >
                  <option value="">No assignment</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.time})
                    </option>
                  ))}
                </select>
              </div>
              {newGuest.assignedService && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Table (optional)</label>
                  <select
                    value={newGuest.assignedTable || ''}
                    onChange={(e) => setNewGuest({ ...newGuest, assignedTable: e.target.value ? parseInt(e.target.value) : null })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  >
                    <option value="">No assignment</option>
                    {tables.map(table => {
                      const occupancy = getTableOccupancy(table.id, newGuest.assignedService!);
                      const available = table.capacity - occupancy;
                      const canFit = available >= 1;
                      return (
                        <option key={table.id} value={table.id} disabled={!canFit}>
                          {table.name} ({available} seats available)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowGuestForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addGuest}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                Add Guest
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditGuest && editingGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Edit Guest</h3>
              <button onClick={() => { setShowEditGuest(false); setEditingGuest(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editingGuest.name}
                  onChange={(e) => setEditingGuest({ ...editingGuest, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={editingGuest.notes}
                  onChange={(e) => setEditingGuest({ ...editingGuest, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  placeholder="Dietary restrictions, VIP, etc."
                />
              </div>
              
              {/* Show groups this guest is part of */}
              {(() => {
                const ledGroups = getGroupsAsLead(editingGuest.id);
                const memberOfGroups = getGroupsAsMember(editingGuest.id);
                if (ledGroups.length === 0 && memberOfGroups.length === 0) return null;
                
                return (
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Groups</label>
                    <div className="space-y-2">
                      {ledGroups.map(g => (
                        <div key={g.id} className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200 text-sm">
                          <Users size={14} className="text-blue-600" />
                          <span className="flex-1 text-blue-900">{g.name || `${g.leadGuestName}'s Group`}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Lead</span>
                        </div>
                      ))}
                      {memberOfGroups.map(g => (
                        <div key={g.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border text-sm">
                          <Users size={14} className="text-gray-400" />
                          <span className="flex-1 text-gray-700">{g.name || `${g.leadGuestName}'s Group`}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">Member</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Go to the Groups tab to manage group memberships
                    </p>
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => { setShowEditGuest(false); setEditingGuest(null); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={updateGuest}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showGroupForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Create New Group</h3>
              <button onClick={() => { setShowGroupForm(false); setNewGroupLeadSearch(''); setNewGroupName(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Wedding Party, Family Smith..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to auto-name by lead guest</p>
              </div>
              
              {/* Lead Guest Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search for Lead Guest</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Type guest name..."
                    value={newGroupLeadSearch}
                    onChange={(e) => setNewGroupLeadSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                </div>
              </div>
              
              {newGroupLeadSearch.trim() && (
                <div className="space-y-2">
                  {/* Matching existing guests */}
                  {guests
                    .filter(g => g.name.toLowerCase().includes(newGroupLeadSearch.toLowerCase()))
                    .slice(0, 5)
                    .map(guest => (
                      <button
                        key={guest.id}
                        onClick={async () => {
                          await createGroup(guest.id, newGroupName.trim() || undefined);
                          setShowGroupForm(false);
                          setNewGroupLeadSearch('');
                          setNewGroupName('');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg border text-left transition"
                      >
                        <Users size={16} className="text-gray-400" />
                        <span className="flex-1 text-sm">{guest.name}</span>
                        <span className="text-xs text-gray-400">Select as lead</span>
                      </button>
                    ))}
                  
                  {/* Create new guest option */}
                  {guests.filter(g => g.name.toLowerCase().includes(newGroupLeadSearch.toLowerCase())).length === 0 && (
                    <button
                      onClick={async () => {
                        const newGuest = await createGuestAndAddToGroup(newGroupLeadSearch.trim());
                        if (newGuest) {
                          await createGroup(newGuest.id, newGroupName.trim() || undefined);
                        }
                        setShowGroupForm(false);
                        setNewGroupLeadSearch('');
                        setNewGroupName('');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-left transition"
                    >
                      <UserPlus size={16} className="text-green-600" />
                      <span className="flex-1 text-sm text-green-800">Create "{newGroupLeadSearch}" and make them lead</span>
                    </button>
                  )}
                  
                  {newGroupLeadSearch.trim() && guests.some(g => g.name.toLowerCase().includes(newGroupLeadSearch.toLowerCase())) && (
                    <button
                      onClick={async () => {
                        const newGuest = await createGuestAndAddToGroup(newGroupLeadSearch.trim());
                        if (newGuest) {
                          await createGroup(newGuest.id, newGroupName.trim() || undefined);
                        }
                        setShowGroupForm(false);
                        setNewGroupLeadSearch('');
                        setNewGroupName('');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-green-50 rounded-lg border text-left transition"
                    >
                      <UserPlus size={16} className="text-gray-400" />
                      <span className="flex-1 text-sm text-gray-600">Create new guest "{newGroupLeadSearch}"</span>
                    </button>
                  )}
                </div>
              )}
              
              {!newGroupLeadSearch.trim() && (
                <p className="text-xs text-gray-500 text-center py-4">
                  Start typing to search for a guest to be the group leader
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {editingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Edit Group</h3>
              <button onClick={() => { setEditingGroup(null); setMemberSearchTerm(''); setEditingGroupName(''); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Group Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`${editingGroup.leadGuestName}'s Group`}
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                  {editingGroupName !== (editingGroup.name || '') && (
                    <button
                      onClick={() => updateGroupName(editingGroup.id, editingGroupName)}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Save
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Leave empty to use "{editingGroup.leadGuestName}'s Group"</p>
              </div>
              
              {/* Group Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Lead</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-200">
                  <Users size={16} className="text-blue-600" />
                  <span className="flex-1 text-sm font-medium text-blue-900">{editingGroup.leadGuestName}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Lead</span>
                </div>
              </div>
              
              {/* Current Members */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Members ({editingGroup.members.length})
                </label>
                <div className="space-y-2">
                  {editingGroup.members.map(member => (
                    <div key={member.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border">
                      <span className={`flex-1 text-sm ${member.isGhost ? 'text-purple-600' : 'text-gray-700'}`}>
                        {member.guestName}
                        {member.isGhost && <span className="ml-1 text-xs">(Ghost)</span>}
                      </span>
                      <button
                        onClick={() => removeMemberFromGroup(editingGroup.id, member.guestId)}
                        className="p-1 text-gray-400 hover:text-red-500 rounded transition"
                        title="Remove from group"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  {editingGroup.members.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">No members yet. Add guests below.</p>
                  )}
                </div>
              </div>
              
              {/* Add Member */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Member</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search guest to add..."
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  />
                </div>
                
                {memberSearchTerm.trim() && (
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {guests
                      .filter(g => g.name.toLowerCase().includes(memberSearchTerm.toLowerCase()))
                      .filter(g => g.id !== editingGroup.leadGuestId)
                      .filter(g => !editingGroup.members.some(m => m.guestId === g.id))
                      .slice(0, 5)
                      .map(guest => (
                        <button
                          key={guest.id}
                          onClick={async () => {
                            await addMemberToGroup(editingGroup.id, guest.id);
                            setMemberSearchTerm('');
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition ${
                            guest.isGhost 
                              ? 'bg-purple-50 hover:bg-purple-100 border-purple-200' 
                              : 'bg-gray-50 hover:bg-blue-50'
                          }`}
                        >
                          <Plus size={14} className="text-gray-400" />
                          <span className={`flex-1 text-sm ${guest.isGhost ? 'text-purple-700' : ''}`}>
                            {guest.name}
                            {guest.isGhost && <span className="ml-1 text-xs">(Ghost)</span>}
                          </span>
                        </button>
                      ))}
                    
                    {/* Create new guest option */}
                    <button
                      onClick={async () => {
                        const newGuest = await createGuestAndAddToGroup(memberSearchTerm.trim(), editingGroup.id);
                        setMemberSearchTerm('');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 text-left transition"
                    >
                      <UserPlus size={14} className="text-green-600" />
                      <span className="flex-1 text-sm text-green-800">Create "{memberSearchTerm}" as new guest</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Group Size Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Group Size:</span>
                  <span className="font-semibold text-gray-900">
                    {1 + editingGroup.members.length} {1 + editingGroup.members.length === 1 ? 'person' : 'people'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => { setEditingGroup(null); setMemberSearchTerm(''); setEditingGroupName(''); }}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplitGroup && splittingGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Split Group Across Tables</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Assign each group member to a table individually
                </p>
              </div>
              <button onClick={() => { setShowSplitGroup(false); setSplittingGuest(null); setSplitAllocations([]); setSplitMemberAssignments({}); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {/* Info banner */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-orange-800 font-medium">Group is too large for any single table</p>
                    <p className="text-xs text-orange-700 mt-1">
                      Click on a member, then click a table to assign them.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Progress */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Members Assigned:</span>
                  <span className={`font-semibold ${
                    Object.values(splitMemberAssignments).every(v => v !== null)
                      ? 'text-green-600'
                      : 'text-orange-600'
                  }`}>
                    {Object.values(splitMemberAssignments).filter(v => v !== null).length} / {Object.keys(splitMemberAssignments).length}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Group Members */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Group Members</h4>
                  <div className="space-y-2">
                    {Object.keys(splitMemberAssignments).map(guestIdStr => {
                      const guestId = parseInt(guestIdStr);
                      const guest = guests.find(g => g.id === guestId);
                      const assignedTableId = splitMemberAssignments[guestId];
                      const assignedTable = assignedTableId ? tables.find(t => t.id === assignedTableId) : null;
                      const isLead = guestId === splittingGuest.id;
                      
                      if (!guest) return null;
                      
                      return (
                        <div 
                          key={guestId}
                          className={`p-2 rounded-lg border transition ${
                            assignedTable 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm ${guest.isGhost ? 'text-purple-600' : 'text-gray-900'}`}>
                                {guest.name}
                              </span>
                              {isLead && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Lead</span>
                              )}
                              {guest.isGhost && (
                                <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">Ghost</span>
                              )}
                            </div>
                            {assignedTable && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-green-700">{assignedTable.name}</span>
                                <button
                                  onClick={() => {
                                    setSplitMemberAssignments(prev => ({
                                      ...prev,
                                      [guestId]: null
                                    }));
                                  }}
                                  className="p-0.5 text-gray-400 hover:text-red-500"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* Right: Available Tables */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Available Tables</h4>
                  <div className="space-y-2">
                    {splitAllocations.map(allocation => {
                      const table = tables.find(t => t.id === allocation.tableId);
                      if (!table) return null;
                      
                      const baseOccupancy = getTableOccupancy(table.id, selectedService);
                      const membersAssignedHere = Object.entries(splitMemberAssignments)
                        .filter(([_, tableId]) => tableId === table.id)
                        .map(([guestId]) => guests.find(g => g.id === parseInt(guestId)));
                      const pendingSeats = membersAssignedHere.length;
                      const available = table.capacity - baseOccupancy - pendingSeats;
                      
                      return (
                        <div 
                          key={table.id}
                          onClick={() => {
                            // Find first unassigned member and assign to this table
                            const unassignedMemberId = Object.entries(splitMemberAssignments)
                              .find(([_, tableId]) => tableId === null)?.[0];
                            if (unassignedMemberId && available > 0) {
                              setSplitMemberAssignments(prev => ({
                                ...prev,
                                [parseInt(unassignedMemberId)]: table.id
                              }));
                            }
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition ${
                            available > 0 
                              ? 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50' 
                              : 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <h5 className="font-medium text-gray-900">{table.name}</h5>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              available > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {available} available
                            </span>
                          </div>
                          {membersAssignedHere.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {membersAssignedHere.map(guest => guest && (
                                <span key={guest.id} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                  {guest.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => { setShowSplitGroup(false); setSplittingGuest(null); setSplitAllocations([]); setSplitMemberAssignments({}); }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSplitGroupByMember}
                disabled={!Object.values(splitMemberAssignments).every(v => v !== null)}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Split
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Member Action Popup (for both assignment and moving) */}
      {groupMemberAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b">
              <h3 className="font-semibold">
                {groupMemberAction.isMove ? 'Move Group Member' : 'Assign Group Member'}
              </h3>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                <strong>{groupMemberAction.guest.name}</strong> is part of a group
                {groupMemberAction.leadGuestId !== groupMemberAction.guest.id && (
                  <> led by <strong>{guests.find(g => g.id === groupMemberAction.leadGuestId)?.name}</strong></>
                )}.
              </p>
              <p className="text-sm text-gray-600">
                {groupMemberAction.isMove 
                  ? 'Would you like to move just this person or the entire group?'
                  : 'Would you like to assign just this person or the entire group?'
                }
              </p>
            </div>
            <div className="p-4 border-t flex flex-col gap-2">
              <button
                onClick={() => {
                  const group = groups.find(g => g.id === groupMemberAction.groupId);
                  if (!group) {
                    setGroupMemberAction(null);
                    return;
                  }
                  
                  if (groupMemberAction.isMove) {
                    // Move entire group - set reassignGuest with moveWholeGroup flag
                    const lead = guests.find(g => g.id === groupMemberAction.leadGuestId);
                    if (lead) {
                      setReassignGuest({ 
                        guest: lead, 
                        fromTableId: groupMemberAction.fromTableId || groupMemberAction.tableId, 
                        serviceId: selectedService,
                        moveWholeGroup: true,
                        groupId: groupMemberAction.groupId
                      });
                    }
                  } else {
                    // Assign entire group
                    assignGroupToTable(groupMemberAction.leadGuestId, groupMemberAction.tableId, selectedService, groupMemberAction.groupId);
                  }
                  setGroupMemberAction(null);
                }}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {groupMemberAction.isMove ? 'Move Entire Group' : 'Assign Entire Group'}
              </button>
              <button
                onClick={() => {
                  if (groupMemberAction.isMove) {
                    // Move just this member
                    setReassignGuest({ 
                      guest: groupMemberAction.guest, 
                      fromTableId: groupMemberAction.fromTableId || groupMemberAction.tableId, 
                      serviceId: selectedService 
                    });
                  } else {
                    // Assign just this member
                    assignGuest(groupMemberAction.guest.id, groupMemberAction.tableId, selectedService, true);
                    const table = tables.find(t => t.id === groupMemberAction.tableId);
                    showNotification(`${groupMemberAction.guest.name} assigned to ${table?.name}`);
                    setSelectedGuest(null);
                    setQuickAssignMode(false);
                  }
                  setGroupMemberAction(null);
                }}
                className="w-full py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                {groupMemberAction.isMove ? 'Move' : 'Assign'} {groupMemberAction.guest.name} Only
              </button>
              <button
                onClick={() => setGroupMemberAction(null)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Group for Assignment Popup */}
      {selectGroupForAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Select Group to Assign</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {selectGroupForAssign.guest.name} leads multiple groups
                </p>
              </div>
              <button onClick={() => setSelectGroupForAssign(null)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {selectGroupForAssign.groups.map(group => {
                const groupSize = getGroupSize(group);
                const table = tables.find(t => t.id === selectGroupForAssign.tableId);
                const occupancy = getTableOccupancy(selectGroupForAssign.tableId, selectedService);
                const available = table ? table.capacity - occupancy : 0;
                const canFit = groupSize <= available;
                const needsSplitForGroup = !canFit && groupSize > getLargestAvailableCapacity(selectedService);
                
                return (
                  <div key={group.id} className="space-y-1">
                    <button
                      onClick={() => {
                        if (canFit) {
                          assignGuest(selectGroupForAssign.guest.id, selectGroupForAssign.tableId, selectedService, false, group.id);
                        }
                      }}
                      disabled={!canFit}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition ${
                        canFit 
                          ? 'bg-gray-50 hover:bg-blue-50 border-gray-200' 
                          : 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div>
                        <span className="font-medium text-sm">
                          {group.name || `${selectGroupForAssign.guest.name}'s Group`}
                        </span>
                        <span className="text-xs text-gray-500 ml-2">
                          ({groupSize} {groupSize === 1 ? 'person' : 'people'})
                        </span>
                        {group.members.length > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            Members: {group.members.slice(0, 3).map(m => m.guestName).join(', ')}
                            {group.members.length > 3 && ` +${group.members.length - 3} more`}
                          </p>
                        )}
                      </div>
                      {!canFit && (
                        <span className="text-xs text-red-500">Won't fit</span>
                      )}
                    </button>
                    {needsSplitForGroup && (
                      <button
                        onClick={() => {
                          setSelectGroupForAssign(null);
                          setSplittingGuest(selectGroupForAssign.guest);
                          
                          // Initialize split with this specific group's members
                          const memberAssignments: Record<number, number | null> = { [group.leadGuestId]: null };
                          group.members.forEach(member => {
                            memberAssignments[member.guestId] = null;
                          });
                          setSplitMemberAssignments(memberAssignments);
                          
                          const availableTables = tables
                            .filter(t => !isTableBlocked(t.id, selectedService))
                            .map(t => ({
                              tableId: t.id,
                              seats: 0,
                              available: t.capacity - getTableOccupancy(t.id, selectedService)
                            }))
                            .filter(t => t.available > 0);
                          setSplitAllocations(availableTables);
                          setShowSplitGroup(true);
                        }}
                        className="w-full py-1.5 text-xs bg-orange-50 text-orange-700 hover:bg-orange-100 rounded transition flex items-center justify-center gap-1"
                      >
                        <AlertCircle size={12} />
                        Split this group across tables
                      </button>
                    )}
                  </div>
                );
              })}
              
              <div className="border-t pt-3 mt-3">
                <button
                  onClick={() => {
                    // Assign just this guest individually
                    assignGuest(selectGroupForAssign.guest.id, selectGroupForAssign.tableId, selectedService, true);
                    setSelectGroupForAssign(null);
                    setSelectedGuest(null);
                    setQuickAssignMode(false);
                    const table = tables.find(t => t.id === selectGroupForAssign.tableId);
                    showNotification(`${selectGroupForAssign.guest.name} assigned to ${table?.name}`);
                  }}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg"
                >
                  Assign only {selectGroupForAssign.guest.name}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showChairManagement && chairTargetTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-semibold">Add Extra Chairs</h3>
                <p className="text-sm text-gray-500 mt-1">
                  To: {chairTargetTable.name} (Current: {chairTargetTable.capacity} seats)
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowChairManagement(false);
                  setChairTargetTable(null);
                  setTempChairAdjustments([]);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-800 font-medium">Take chairs from other tables</p>
                    <p className="text-xs text-blue-700 mt-1">
                      Select which tables to remove chairs from. This only affects {services.find(s => s.id === selectedService)?.name}.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total chairs to add:</span>
                  <span className={`font-semibold ${
                    tempChairAdjustments.reduce((sum, a) => sum + Math.abs(a.chairs), 0) > 0
                      ? 'text-blue-600'
                      : 'text-gray-600'
                  }`}>
                    +{tempChairAdjustments.reduce((sum, a) => sum + Math.abs(a.chairs), 0)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  New capacity: {chairTargetTable.capacity} → {chairTargetTable.capacity + tempChairAdjustments.reduce((sum, a) => sum + Math.abs(a.chairs), 0)}
                </p>
              </div>
              
              <div className="space-y-3">
                {tables
                  .filter(t => t.id !== chairTargetTable.id)
                  .map(table => {
                    const currentAdjustment = chairAdjustments[`${selectedDay}-${selectedService}`]?.[table.id] || 0;
                    const capacity = table.capacity + currentAdjustment;
                    const occupancy = getTableOccupancy(table.id, selectedService);
                    const available = capacity - occupancy;
                    const tempAdj = tempChairAdjustments.find(a => a.tableId === table.id);
                    const removing = tempAdj ? Math.abs(tempAdj.chairs) : 0;
                    
                    return (
                      <div key={table.id} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900">{table.name}</h4>
                            <p className="text-xs text-gray-500">
                              Available: {available} | Occupied: {occupancy}/{capacity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const newAdj = tempChairAdjustments.filter(a => a.tableId !== table.id);
                                if (removing > 0) {
                                  newAdj.push({ tableId: table.id, chairs: -(removing - 1) });
                                }
                                setTempChairAdjustments(newAdj.filter(a => a.chairs !== 0));
                              }}
                              disabled={removing === 0}
                              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              -
                            </button>
                            <span className="w-12 text-center font-semibold">{removing}</span>
                            <button
                              onClick={() => {
                                const newAdj = tempChairAdjustments.filter(a => a.tableId !== table.id);
                                if (removing < available) {
                                  newAdj.push({ tableId: table.id, chairs: -(removing + 1) });
                                }
                                setTempChairAdjustments(newAdj);
                              }}
                              disabled={removing >= available}
                              className="w-8 h-8 flex items-center justify-center rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        {removing > 0 && (
                          <div className="mt-2 text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                            Removing {removing} chair{removing !== 1 ? 's' : ''} from {table.name}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
            
            <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
              <button
                onClick={() => {
                  setShowChairManagement(false);
                  setChairTargetTable(null);
                  setTempChairAdjustments([]);
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleChairManagement}
                disabled={tempChairAdjustments.reduce((sum, a) => sum + Math.abs(a.chairs), 0) === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Chairs
              </button>
            </div>
          </div>
        </div>
      )}

      {showTableForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Add New Table</h3>
              <button onClick={() => setShowTableForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Table Name</label>
                <input
                  type="text"
                  value={newTable.name}
                  onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                  placeholder="e.g., Table 9, VIP Table"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={newTable.capacity}
                  onChange={(e) => setNewTable({ ...newTable, capacity: parseInt(e.target.value) || 6 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowTableForm(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={addTable}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                Add Table
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 relative overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Import Guest List</h3>
              <button 
                onClick={() => !isImporting && setShowImport(false)} 
                className={`text-gray-400 hover:text-gray-600 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isImporting}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 relative">
              {/* Loading Overlay */}
              {isImporting && (
                <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-10">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-200 border-t-red-700 mb-4"></div>
                  <p className="text-gray-700 font-medium">Importing guests...</p>
                  {importProgress.total > 0 && (
                    <div className="mt-3 w-48">
                      <div className="flex justify-between text-sm text-gray-500 mb-1">
                        <span>{importProgress.current} of {importProgress.total}</span>
                        <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-700 transition-all duration-300"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {/* Excel Upload with Drag & Drop */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Excel File (.xlsx, .xls)
                </label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
                    isDraggingFile 
                      ? 'border-red-500 bg-red-50 scale-[1.02]' 
                      : 'border-gray-300 hover:border-red-400'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(true);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDraggingFile(false);
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                      const file = files[0];
                      const validTypes = [
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        'application/vnd.ms-excel',
                        'text/csv'
                      ];
                      const validExtensions = ['.xlsx', '.xls', '.csv'];
                      const hasValidExtension = validExtensions.some(ext => 
                        file.name.toLowerCase().endsWith(ext)
                      );
                      
                      if (validTypes.includes(file.type) || hasValidExtension) {
                        importExcelFile(file);
                      } else {
                        showNotification('Please upload an Excel file (.xlsx, .xls) or CSV', 'error');
                      }
                    }
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        importExcelFile(file);
                      }
                    }}
                    className="hidden"
                    id="excel-upload"
                    disabled={isImporting}
                  />
                  <label htmlFor="excel-upload" className={`cursor-pointer ${isImporting ? 'pointer-events-none opacity-50' : ''}`}>
                    {isDraggingFile ? (
                      <>
                        <Download className="mx-auto h-10 w-10 text-red-500 mb-2 animate-bounce" />
                        <p className="text-sm font-medium text-red-600">Drop file here!</p>
                      </>
                    ) : (
                      <>
                        <Upload className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 font-medium">
                          Drag & drop your Excel file here
                        </p>
                        <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                        <p className="text-xs text-gray-400 mt-2">
                          First column = Name, Second column = Notes (optional)
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="text-xs text-gray-400">OR</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
              
              {/* Text Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste Guest List
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Enter guests, one per line. Format: <code className="bg-gray-100 px-1 rounded">Name, Notes</code>
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700 font-mono text-sm"
                  placeholder="John Smith, VIP&#10;Jane Doe&#10;Bob Johnson, Vegetarian"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => !isImporting && setShowImport(false)}
                disabled={isImporting}
                className={`px-4 py-2 text-sm text-gray-600 hover:text-gray-800 ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Cancel
              </button>
              <button
                onClick={importGuests}
                disabled={!importText.trim() || isImporting}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Import Text
              </button>
            </div>
          </div>
        </div>
      )}

      {showWeekOverview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Week Overview</h3>
              <button onClick={() => setShowWeekOverview(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-3 bg-gray-50 border font-medium text-gray-700">Day</th>
                      {services.map(service => (
                        <th key={service.id} className={`p-3 border font-medium ${service.lightColor} ${service.textColor}`}>
                          <div>{service.name}</div>
                          <div className="text-xs font-normal opacity-75">{service.time}</div>
                        </th>
                      ))}
                      <th className="p-3 bg-gray-50 border font-medium text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => {
                      let dayTotal = 0;
                      return (
                        <tr key={day.id} className={selectedDay === day.id ? 'bg-red-50' : ''}>
                          <td className="p-3 border font-medium">
                            <button
                              onClick={() => {
                                setSelectedDay(day.id);
                                setShowWeekOverview(false);
                              }}
                              className="text-red-700 hover:text-red-800 hover:underline"
                            >
                              {day.name}
                            </button>
                          </td>
                          {services.map(service => {
                            const assignedGuestIds = [...new Set(Object.keys(assignments)
                              .filter(k => k.startsWith(`${day.id}-${service.id}-`))
                              .flatMap(k => assignments[k]))];
                            // Exclude ghosts from counts
                            const nonGhostIds = assignedGuestIds.filter(id => {
                              const guest = guests.find(g => g.id === id);
                              return guest && !guest.isGhost;
                            });
                            const totalGuests = nonGhostIds.length;
                            const totalSeats = totalGuests; // Each guest = 1 seat
                            const dayArrivals = arrivedGuests[day.id] || new Set();
                            const arrived = nonGhostIds.filter(id => dayArrivals.has(id)).length;
                            dayTotal += totalGuests;
                            
                            return (
                              <td key={service.id} className="p-3 border text-center">
                                {totalGuests > 0 ? (
                                  <div>
                                    <div className="font-semibold text-gray-900">{totalGuests} guests</div>
                                    <div className="text-xs text-gray-500">{totalSeats} seats</div>
                                    {arrived > 0 && (
                                      <div className="text-xs text-green-600">✓ {arrived} arrived</div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-3 border text-center font-semibold bg-gray-50">
                            {dayTotal > 0 ? dayTotal : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100">
                      <td className="p-3 border font-semibold">Week Total</td>
                      {services.map(service => {
                        const serviceTotal = DAYS.reduce((sum, day) => {
                          const assignedGuestIds = Object.keys(assignments)
                            .filter(k => k.startsWith(`${day.id}-${service.id}-`))
                            .flatMap(k => assignments[k]);
                          // Exclude ghosts
                          const nonGhostCount = assignedGuestIds.filter(id => {
                            const guest = guests.find(g => g.id === id);
                            return guest && !guest.isGhost;
                          }).length;
                          return sum + nonGhostCount;
                        }, 0);
                        return (
                          <td key={service.id} className="p-3 border text-center font-semibold">
                            {serviceTotal > 0 ? serviceTotal : '—'}
                          </td>
                        );
                      })}
                      <td className="p-3 border text-center font-bold text-red-700">
                        {DAYS.reduce((total, day) => {
                          return total + services.reduce((sum, service) => {
                            const assignedGuestIds = Object.keys(assignments)
                              .filter(k => k.startsWith(`${day.id}-${service.id}-`))
                              .flatMap(k => assignments[k]);
                            // Exclude ghosts
                            const nonGhostCount = assignedGuestIds.filter(id => {
                              const guest = guests.find(g => g.id === id);
                              return guest && !guest.isGhost;
                            }).length;
                            return sum + nonGhostCount;
                          }, 0);
                        }, 0) || '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">{guests.length}</div>
                  <div className="text-sm text-gray-500">Total Guests</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">{tables.length}</div>
                  <div className="text-sm text-gray-500">Tables</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-gray-900">
                    {tables.reduce((sum, t) => sum + t.capacity, 0)}
                  </div>
                  <div className="text-sm text-gray-500">Total Capacity</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {Object.values(arrivedGuests).reduce((sum, set) => sum + set.size, 0)}
                  </div>
                  <div className="text-sm text-gray-500">Total Arrivals</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showServiceSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock size={20} />
                Edit Service Times
              </h3>
              <button onClick={() => setShowServiceSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {services.map((service, index) => (
                <div key={service.id} className={`p-4 rounded-lg ${service.lightColor}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-3 h-3 rounded-full ${service.color}`} />
                    <span className={`font-medium ${service.textColor}`}>Service {service.id}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                      <input
                        type="text"
                        value={service.name}
                        onChange={(e) => {
                          const newServices = [...services];
                          newServices[index] = { ...service, name: e.target.value };
                          setServices(newServices);
                        }}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Time</label>
                      <input
                        type="text"
                        value={service.time}
                        onChange={(e) => {
                          const newServices = [...services];
                          newServices[index] = { ...service, time: e.target.value };
                          setServices(newServices);
                        }}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-700 focus:border-red-700"
                        placeholder="e.g., 11:30 - 12:30"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setServices(DEFAULT_SERVICES)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Reset to Default
              </button>
              <button
                onClick={() => {
                  setShowServiceSettings(false);
                  showNotification('Service times updated');
                }}
                className="px-4 py-2 text-sm bg-red-700 text-white rounded-lg hover:bg-red-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoomEditor && (
        <RoomEditor
          tables={tables}
          onTableDrag={handleTableDrag}
          onAddTable={handleAddTableFromEditor}
          onRemoveTable={deleteTable}
          onClose={() => setShowRoomEditor(false)}
        />
      )}
    </div>
  );
}
