import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Seat, SeatType, SeatStatus, Student } from '../types';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash, 
  Grid, 
  AlertCircle, 
  ArrowLeft, 
  ArrowRight, 
  UserPlus, 
  UserMinus, 
  User, 
  Calendar, 
  CreditCard, 
  X, 
  Check 
} from 'lucide-react';

const getFeeAlert = (student: Student) => {
  const isPending = student.feeStatus === 'Pending';
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = student.dueDate ? new Date(student.dueDate) : null;
  const isOverdue = due ? due < today : false;
  
  if (isOverdue) {
    return {
      type: 'overdue',
      label: '🚨 Overdue Alert',
      class: 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse font-bold',
      desc: `Overdue since ${student.dueDate}`
    };
  } else if (isPending) {
    return {
      type: 'pending',
      label: '⚠️ Fee Pending',
      class: 'bg-amber-50 border-amber-250 text-amber-850 font-bold',
      desc: `Due date: ${student.dueDate}`
    };
  }
  return {
    type: 'paid',
    label: '✨ Fee Paid',
    class: 'bg-emerald-50 border-emerald-255 text-emerald-800 font-bold',
    desc: `Next: ${student.dueDate}`
  };
};

export const SeatManagement: React.FC = () => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
    cancelText?: string;
    isDangerous?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    onConfirm: () => {}
  });

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDangerous = false
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm: () => {
        onConfirm();
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
      },
      isDangerous
    });
  };

  // Assignment Modal/Sheet state
  const [assigningSeat, setAssigningSeat] = useState<Seat | null>(null);
  const [assignTab, setAssignTab] = useState<'existing' | 'new'>('existing');
  
  // Assignment form states
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [newStudName, setNewStudName] = useState('');
  const [newStudMobile, setNewStudMobile] = useState('');
  const [newStudFather, setNewStudFather] = useState('');
  const [newStudAddress, setNewStudAddress] = useState('');
  const [newStudFee, setNewStudFee] = useState('550');
  const [newStudShift, setNewStudShift] = useState<'Full Day' | 'Morning Shift' | 'Evening Shift'>('Morning Shift');
  const [newStudJoiningDate, setNewStudJoiningDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newStudStatus, setNewStudStatus] = useState<SeatStatus>('Occupied'); // Occupied vs Reserved

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [floorFilter, setFloorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form Mode: 'list' | 'add' | 'edit'
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);

  // Form Fields
  const [seatNumber, setSeatNumber] = useState('');
  const [floor, setFloor] = useState('Ground Floor');
  const [seatType, setSeatType] = useState<SeatType>('Normal');
  const [status, setStatus] = useState<SeatStatus>('Available');
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Floor-wise custom capacity states
  const [customGround, setCustomGround] = useState('40');
  const [customFirst, setCustomFirst] = useState('40');
  const [customSecond, setCustomSecond] = useState('23');
  const [apiSuccessMsg, setApiSuccessMsg] = useState<string | null>(null);

  const handleScaleFloorWise = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setApiSuccessMsg(null);
    
    const gVal = parseInt(customGround, 10);
    const fVal = parseInt(customFirst, 10);
    const sVal = parseInt(customSecond, 10);

    if (isNaN(gVal) || isNaN(fVal) || isNaN(sVal) || gVal < 0 || fVal < 0 || sVal < 0) {
      setFormError("Please enter valid, non-negative seat counts.");
      return;
    }

    const totalNew = gVal + fVal + sVal;

    triggerConfirm(
      "🛠️ Re-Build Floor Seating Grid?",
      `Are you sure you want to regenerate all library seats? Ground Floor will have ${gVal}, 1st Floor will have ${fVal}, and 2nd Floor will have ${sVal} (total: ${totalNew} seats). Active assigned students will remain, and dynamic seat synchronization will run.`,
      async () => {
        setFormLoading(true);
        try {
          await api.generateFloorWiseSeats(gVal, fVal, sVal);
          setApiSuccessMsg(`Successfully generated ${totalNew} seats floor-wise!`);
          await loadSeats();
        } catch (err: any) {
          setFormError(err.message || "Failed to generate floor setup.");
        } finally {
          setFormLoading(false);
        }
      }
    );
  };

  const handleResetTo103 = async () => {
    setFormError(null);
    setApiSuccessMsg(null);
    triggerConfirm(
      "🔄 Reset Grid to 103 Seats?",
      "Are you sure you want to reset and normalize the physical layout to exactly 103 seats? (Ground Floor: 1-40, 1st Floor: 41-80, 2nd Floor: 81-103). Active students who have their seat numbers in this range will automatically stay allocated.",
      async () => {
        setFormLoading(true);
        try {
          await api.resetTo103Seats();
          setApiSuccessMsg("Successfully normalized layout to exactly 103 seats!");
          setCustomGround('40');
          setCustomFirst('40');
          setCustomSecond('23');
          await loadSeats();
        } catch (err: any) {
          setFormError(err.message || "Failed to reset to 103 seats.");
        } finally {
          setFormLoading(false);
        }
      }
    );
  };

  useEffect(() => {
    loadSeats();
  }, []);

  const loadSeats = async () => {
    try {
      setLoading(true);
      setError(null);
      const [seatsData, studentsData] = await Promise.all([
        api.getSeats(),
        api.getStudents()
      ]);
      setSeats(seatsData);
      setStudents(studentsData);
    } catch (err: any) {
      setError(err.message || "Failed to load seats and students data.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClick = () => {
    setSeatNumber('');
    setFloor('Ground Floor');
    setSeatType('Normal');
    setStatus('Available');
    setFormError(null);
    setMode('add');
  };

  const handleEditClick = (seat: Seat) => {
    setEditingSeat(seat);
    setSeatNumber(seat.seatNumber);
    setFloor(seat.floor);
    setSeatType(seat.seatType);
    setStatus(seat.status);
    setFormError(null);
    setMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!seatNumber.trim()) {
      return setFormError("Seat Number is physical key identifier, cannot be empty.");
    }

    const actionText = mode === 'add' ? 'create a new seat record' : `save changes to seat "${editingSeat?.seatNumber}"`;

    triggerConfirm(
      mode === 'add' ? "➕ Define New Physical Seat?" : "✏️ Save Seating Configuration Changes?",
      `Are you sure you want to ${actionText}?`,
      async () => {
        setFormLoading(true);
        try {
          const payload = { seatNumber: seatNumber.trim(), floor, seatType, status };
          if (mode === 'add') {
            await api.addSeat(payload);
          } else if (mode === 'edit' && editingSeat) {
            await api.editSeat(editingSeat.id, payload);
          }
          // Reload and return to list
          await loadSeats();
          setMode('list');
        } catch (err: any) {
          setFormError(err.message || "Operation failed.");
        } finally {
          setFormLoading(false);
        }
      },
      mode === 'add' ? "Yes, Add Seat" : "Yes, Save",
      "No, Cancel"
    );
  };

  const handleDelete = (id: string, seatNo: string) => {
    triggerConfirm(
      "🗑️ Delete Seat Record?",
      `Are you sure you want to permanently delete physical seat "${seatNo}" from the registry?`,
      async () => {
        try {
          await api.deleteSeat(id);
          await loadSeats();
        } catch (err: any) {
          alert(err.message || "Failed to delete seat. Check if assigned.");
        }
      },
      "Yes, Delete",
      "No, Cancel",
      true
    );
  };

  const handleClearAllSeats = () => {
    triggerConfirm(
      "☢️ WARNING: Clear All Seating Configurations?",
      "Are you absolutely sure you want to permanently delete ALL defined seats? This will clear the entire digital seating layout. Active assigned students will retain their profile records but their physical seats will be unassigned in the pool.",
      async () => {
        try {
          setLoading(true);
          await api.clearAllSeats();
          await loadSeats();
        } catch (err: any) {
          setError(err.message || "Failed to clear all seats.");
        } finally {
          setLoading(false);
        }
      },
      "Yes, Clear Seating Layout",
      "No, Cancel Clear",
      true
    );
  };

  const handleAssignStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSeat) return;
    setFormLoading(true);
    setFormError(null);

    try {
      if (assignTab === 'existing') {
        if (!selectedStudentId) {
          throw new Error("Please select a student to assign.");
        }
        const student = students.find(s => s.id === selectedStudentId);
        if (!student) throw new Error("Selected student not found.");
        
        const updatedPayload = {
          ...student,
          seatNumber: assigningSeat.seatNumber,
          status: 'Active',
          shift: student.shift || (assigningSeat.seatType === 'Full Day Seat' ? 'Full Day' : 'Morning Shift')
        };
        await api.editStudent(student.id, updatedPayload);
      } else {
        if (!newStudName.trim()) throw new Error("Full name is required.");
        if (!newStudMobile.trim()) throw new Error("Mobile number is required.");
        if (!newStudFee || isNaN(parseFloat(newStudFee))) throw new Error("Valid fee amount is required.");

        const thirtyDays = new Date(newStudJoiningDate);
        thirtyDays.setDate(thirtyDays.getDate() + 30);

        const payload = {
          fullName: newStudName.trim(),
          fatherName: newStudFather.trim(),
          mobile: newStudMobile.trim(),
          email: '',
          address: newStudAddress.trim(),
          aadhaar: '',
          seatNumber: assigningSeat.seatNumber,
          joiningDate: newStudJoiningDate,
          endDate: '',
          profilePhoto: '',
          feeAmount: parseFloat(newStudFee),
          status: 'Active',
          shift: newStudShift,
          feeStatus: 'Pending',
          dueDate: thirtyDays.toISOString().split('T')[0]
        };
        await api.addStudent(payload);
      }

      // If custom status was Reserved, update the seat status to 'Reserved'
      if (newStudStatus === 'Reserved') {
        await api.editSeat(assigningSeat.id, {
          seatNumber: assigningSeat.seatNumber,
          floor: assigningSeat.floor,
          seatType: assigningSeat.seatType,
          status: 'Reserved'
        });
      }

      setAssigningSeat(null);
      // Reset inputs
      setSelectedStudentId('');
      setNewStudName('');
      setNewStudMobile('');
      setNewStudFather('');
      setNewStudAddress('');
      setNewStudFee('550');
      setNewStudShift('Morning Shift');
      await loadSeats();
    } catch (err: any) {
      setFormError(err.message || "Failed to assign student.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleReleaseStudentFromSeat = (occupant: Student, seat: Seat) => {
    triggerConfirm(
      "🔓 Remove Student from Seat?",
      `Are you sure you want to release seat "${seat.seatNumber}" from student "${occupant.fullName}" (${occupant.shift})? Their profile record remains active under Student Management, but their seat allocation will join the available seat pool.`,
      async () => {
        try {
          setLoading(true);
          setError(null);
          const updatedPayload = {
            ...occupant,
            seatNumber: ""
          };
          await api.editStudent(occupant.id, updatedPayload);
          await loadSeats();
        } catch (err: any) {
          setError(err.message || "Failed to remove student from seat.");
        } finally {
          setLoading(false);
        }
      },
      "Yes, Remove Seat",
      "No, Keep Assigned",
      true
    );
  };

  // Filter Logic
  const filteredSeats = seats.filter(seat => {
    const matchesSearch = seat.seatNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFloor = floorFilter ? seat.floor === floorFilter : true;
    const matchesType = typeFilter ? seat.seatType === typeFilter : true;
    const matchesStatus = statusFilter ? seat.status === statusFilter : true;
    return matchesSearch && matchesFloor && matchesType && matchesStatus;
  });

  // Pagination bounds
  const totalItems = filteredSeats.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSeats = filteredSeats.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, floorFilter, typeFilter, statusFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-sans font-extrabold text-slate-900 tracking-tight">Seat Management</h1>
          <p className="text-xs text-slate-500">Configure library seating layouts, floors allocations and monitor occupants status.</p>
        </div>
        {mode === 'list' && (
          <div className="flex items-center gap-2 shrink-0">
            {seats.length > 0 && (
              <button
                onClick={handleClearAllSeats}
                className="inline-flex items-center space-x-2 bg-red-50 border border-red-200 text-red-650 px-3.5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-100 transition shadow-2xs"
              >
                <Trash className="w-3.5 h-3.5" />
                <span>Clear All Seats</span>
              </button>
            )}
            <button
              onClick={handleCreateClick}
              className="inline-flex items-center space-x-2 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-amber-600 transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Seat</span>
            </button>
          </div>
        )}
      </div>

      {/* QUICK STUDENT REGISTRATION HELPER NOTE */}
      {mode === 'list' && (
        <div className="bg-indigo-50/70 border border-indigo-150 rounded-[20px] p-4 flex items-start space-x-3 text-indigo-900 text-xs shadow-3xs">
          <UserPlus className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-sans font-black text-indigo-950 block">✨ Student Add & Allocation Guide</span>
            <span className="text-slate-650 leading-relaxed block">
              To add a student, locate any <span className="text-emerald-700 font-bold">● Available</span> seat in your desired section/floor below, click the <strong className="text-indigo-950 font-bold uppercase tracking-wider bg-indigo-100/60 border border-indigo-200 px-2 py-0.5 rounded text-[10px]">🎯 Assign</strong> button, and choose the <strong>"Quick New Registration"</strong> tab to insert student detail and seat number! This keeps physical seating perfectly in sync.
            </span>
          </div>
        </div>
      )}

      {/* BULK & FLOOR-WISE SEATING CONFIGURATOR */}
      {mode === 'list' && (
        <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-6 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-sm font-sans font-extrabold text-slate-900 flex items-center gap-1.5">
                <Grid className="w-4 h-4 text-amber-500" />
                Floor-wise Seats Capacity & Setup Control
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Current allocation: <strong>Ground Floor:</strong> {seats.filter(s => s.floor === 'Ground Floor').length} seats | <strong>1st Floor:</strong> {seats.filter(s => s.floor === '1st Floor').length} seats | <strong>2nd Floor:</strong> {seats.filter(s => s.floor === '2nd Floor').length} seats (Total: <span className="text-indigo-600 font-bold">{seats.length}</span> / 103 seats config)
              </p>
            </div>
            <button
              onClick={handleResetTo103}
              disabled={formLoading}
              className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-750 text-xs font-black rounded-xl transition duration-150 inline-flex items-center gap-1.5 shrink-0"
            >
              🔄 Fix & Reset to Standard 103 Seats Layout
            </button>
          </div>

          <form onSubmit={handleScaleFloorWise} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-white border border-slate-200/80 p-4 rounded-2xl">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Ground Floor Seats</label>
              <input
                type="number"
                min="0"
                value={customGround}
                onChange={(e) => setCustomGround(e.target.value)}
                placeholder="Seats count"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">1st Floor Seats</label>
              <input
                type="number"
                min="0"
                value={customFirst}
                onChange={(e) => setCustomFirst(e.target.value)}
                placeholder="Seats count"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">2nd Floor Seats</label>
              <input
                type="number"
                min="0"
                value={customSecond}
                onChange={(e) => setCustomSecond(e.target.value)}
                placeholder="Seats count"
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs py-2.5 px-4 rounded-xl transition duration-150 inline-flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Update Floor Layouts</span>
            </button>
          </form>

          {apiSuccessMsg && (
            <div className="p-3 bg-emerald-100/70 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-1.5 font-bold">
              <span>🎉 {apiSuccessMsg}</span>
            </div>
          )}
          {formError && (
            <div className="p-3 bg-rose-100/70 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-1.5 font-bold">
              <span>⚠️ {formError}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-650 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VIEW LIST MODE */}
      {mode === 'list' ? (
        <div className="bg-white border border-slate-200 rounded-[24px] shadow-xs overflow-hidden space-y-6 p-6">
          
          {/* SEARCH & FILTER BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Seats (e.g. S-01)..."
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-amber-500/30"
              />
            </div>

            <select
              value={floorFilter}
              onChange={(e) => setFloorFilter(e.target.value)}
              className="p-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-1 focus:ring-amber-500/30"
            >
              <option value="">All Floors</option>
              <option value="Ground Floor">Ground Floor</option>
              <option value="1st Floor">1st Floor</option>
              <option value="2nd Floor">2nd Floor</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="p-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-1 focus:ring-amber-500/30"
            >
              <option value="">All Seat Types</option>
              <option value="Normal">Normal</option>
              <option value="Premium">Premium</option>
              <option value="Cabin">Cabin</option>
              <option value="AC Cabin">AC Cabin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 text-xs border border-slate-200 rounded-xl bg-white outline-none focus:ring-1 focus:ring-amber-500/30"
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Reserved">Reserved</option>
            </select>
          </div>

          {/* DATA TABLE */}
          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-105 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4">Seat Number</th>
                  <th className="p-4">Floor Location</th>
                  <th className="p-4">Seat Type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedSeats.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-mono">No matching seats found.</td>
                  </tr>
                ) : (
                  paginatedSeats.map((seat) => {
                    const activeOccupants = students.filter(s => s.status === 'Active' && s.seatNumber === seat.seatNumber);
                    return (
                      <tr key={seat.id} className="hover:bg-slate-50/50 align-top">
                        <td className="p-4 font-bold text-slate-800">
                          <div className="flex items-center space-x-2">
                            <Grid className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{seat.seatNumber}</span>
                          </div>
                          
                          {activeOccupants.length > 0 ? (
                            <div className="mt-2.5 space-y-2 max-w-[280px]">
                              {activeOccupants.map(occupant => {
                                const alertInfo = getFeeAlert(occupant);
                                return (
                                  <div key={occupant.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 relative">
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="flex items-center space-x-1.5 overflow-hidden">
                                        <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        <span className="font-bold text-slate-900 truncate text-[11px]" title={occupant.fullName}>
                                          {occupant.fullName}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleReleaseStudentFromSeat(occupant, seat)}
                                        className="text-red-650 hover:text-red-850 hover:bg-red-100 px-2 py-1 rounded-md transition font-bold shrink-0 flex items-center space-x-0.5 text-[9px] border border-red-250 bg-white"
                                        title={`Release ${occupant.fullName} from seat`}
                                      >
                                        <UserMinus className="w-3 h-3 text-red-600 shrink-0" />
                                        <span>Remove</span>
                                      </button>
                                    </div>
                                    <div className="text-[10px] text-slate-650 space-y-1 font-sans font-medium">
                                      <p className="flex items-center space-x-1">
                                        <span className="text-slate-400 font-bold">Shift:</span> 
                                        <span className="font-extrabold text-indigo-800">{occupant.shift || 'Full Day'}</span>
                                      </p>
                                      <p className="flex items-center space-x-1">
                                        <span className="text-slate-400">Mob:</span> <span className="select-all text-slate-800">{occupant.mobile}</span>
                                      </p>
                                      <p className="flex items-center space-x-1">
                                        <span className="text-slate-400">Joined:</span> <span className="font-mono text-slate-850">{occupant.joiningDate}</span>
                                      </p>
                                      <div className="flex items-center gap-1 mt-1 flex-wrap pt-1 border-t border-slate-100">
                                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 rounded text-[8px] font-bold font-mono">
                                          ₹{occupant.feeAmount}/mo
                                        </span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold border uppercase font-mono ${alertInfo.class}`}>
                                          {alertInfo.label}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-400 mt-1 italic font-normal">Available (No active occupants)</p>
                          )}
                        </td>
                        <td className="p-4 text-slate-550 font-medium">{seat.floor}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${
                            seat.seatType === 'AC Cabin' ? 'bg-sky-50 border-sky-100 text-sky-850' :
                            seat.seatType === 'Cabin' ? 'bg-indigo-50 border-indigo-150 text-indigo-850' :
                            seat.seatType === 'Premium' ? 'bg-amber-50 border-amber-150 text-amber-850' :
                            'bg-slate-50 border-slate-150 text-slate-750'
                          }`}>
                            {seat.seatType}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            seat.status === 'Available' ? 'bg-emerald-50 text-emerald-700' :
                            seat.status === 'Occupied' ? 'bg-amber-50 text-amber-700' :
                            'bg-blue-50 text-blue-700'
                          }`}>
                            ● {seat.status}
                          </span>
                        </td>
                        <td className="p-4 text-right space-y-1.5 flex flex-col items-end sm:flex-row sm:space-y-0 sm:space-x-1.5 sm:justify-end shrink-0">
                          <button
                            onClick={() => triggerConfirm(
                              "✏️ Edit Seat Details?",
                              `Are you sure you want to review and edit configuration details for physical seat "${seat.seatNumber}"?`,
                              () => handleEditClick(seat),
                              "Yes, Edit Seat",
                              "Cancel"
                            )}
                            className="inline-flex items-center justify-center bg-slate-50 border border-slate-205 text-slate-700 p-2 rounded-xl text-xs font-semibold hover:bg-slate-100 transition shadow-3xs"
                            title="Edit Seat"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(seat.id, seat.seatNumber)}
                            className="inline-flex items-center justify-center bg-red-50 border border-red-200 text-red-650 p-2 rounded-xl text-xs font-semibold hover:bg-red-100 transition shadow-3xs"
                            title="Delete Seat"
                          >
                            <Trash className="w-3.5 h-3.5 text-red-650" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION PANEL */}
          <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
            <span>Showing {paginatedSeats.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} items</span>
            <div className="flex space-x-1.5 items-center">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-205 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="font-mono">{currentPage}/{totalPages}</span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-205 rounded-lg bg-white disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* CREATE / EDIT FORM VIEW */
        <div className="bg-white border border-slate-205 p-8 rounded-[24px] max-w-2xl shadow-xs space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="font-sans font-bold text-slate-800 text-lg">
              {mode === 'add' ? 'Register New Seat' : 'Edit Seat Details'}
            </h2>
            <button
              onClick={() => setMode('list')}
              className="text-xs text-slate-550 hover:text-slate-800 font-bold transition"
            >
              Cancel Back
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-650 shrink-0 mt-0.5" />
              <span className="font-medium">{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Seat Number Identifier *</label>
                <input
                  type="text"
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  placeholder="e.g. S-45"
                  className="w-full text-xs font-medium p-3.5 border border-slate-202 rounded-xl outline-none focus:ring-1 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Floor Location</label>
                <select
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full text-xs font-medium p-3.5 border border-slate-202 rounded-xl bg-white outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  <option value="Ground Floor">Ground Floor</option>
                  <option value="1st Floor">1st Floor</option>
                  <option value="2nd Floor">2nd Floor</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Seat Type Category</label>
                <select
                  value={seatType}
                  onChange={(e) => setSeatType(e.target.value as SeatType)}
                  className="w-full text-xs font-medium p-3.5 border border-slate-202 rounded-xl bg-white outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  <option value="Full Day Seat">Full Day Seat</option>
                  <option value="Half Day Seat">Half Day Seat</option>
                  <option value="Normal">Normal</option>
                  <option value="Premium">Premium</option>
                  <option value="Cabin">Cabin</option>
                  <option value="AC Cabin">AC Cabin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Current Occupant Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SeatStatus)}
                  className="w-full text-xs font-medium p-3.5 border border-slate-202 rounded-xl bg-white outline-none focus:ring-1 focus:ring-amber-500/50"
                >
                  <option value="Available">Available</option>
                  <option value="Occupied">Occupied</option>
                  <option value="Reserved">Reserved</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-slate-950 text-white font-bold text-xs p-3.5 rounded-xl hover:bg-slate-800 transition disabled:opacity-50 shadow-xs"
            >
              {formLoading ? 'Recording Seating Configuration...' : 'Save Seat'}
            </button>
          </form>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-[24px] p-6 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-xl ${confirmModal.isDangerous ? 'bg-red-50 text-red-600 border border-red-105' : 'bg-indigo-50 text-indigo-600 border border-indigo-105'}`}>
                <AlertCircle className="w-5 h-5 shrink-0" />
              </div>
              <h3 className="text-sm font-sans font-black text-slate-900 tracking-tight">{confirmModal.title}</h3>
            </div>
            <p className="text-xs text-slate-650 leading-relaxed font-sans font-medium">{confirmModal.message}</p>
            <div className="flex space-x-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 font-bold text-xs py-2.5 rounded-xl transition"
              >
                {confirmModal.cancelText || 'Cancel'}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className={`flex-1 font-bold text-xs py-2.5 rounded-xl transition text-white ${
                  confirmModal.isDangerous 
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-850' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850'
                }`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
