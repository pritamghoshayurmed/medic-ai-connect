import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Appointment, Patient } from "@/types";
import { toAppointmentWithPatient } from "@/utils/typeHelpers";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Calendar, Clock, Pencil, X, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function DoctorAppointments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<(Appointment & { patient: Patient })[]>([]);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchAppointments = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('appointments')
          .select(`
            *,
            patient:patient_id (
              id,
              full_name,
              email,
              phone,
              role
            )
          `)
          .eq('doctor_id', user.id);

        if (error) {
          console.error('Error fetching appointments:', error);
          return;
        }

        if (data) {
          console.log("Appointment data:", data);
          // Transform data to match our interface
          const formattedAppointments = data.map(appt => toAppointmentWithPatient({
            id: appt.id,
            patientId: appt.patient_id,
            doctorId: appt.doctor_id,
            date: appt.appointment_date,
            time: appt.appointment_time,
            status: appt.status,
            reason: appt.symptoms || '',
            patient: {
              id: appt.patient.id,
              name: appt.patient.full_name,
              email: appt.patient.email,
              phone: appt.patient.phone || '',
              role: 'patient'
            }
          }));

          setAppointments(formattedAppointments);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [user]);

  function getFilteredAppointments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (activeTab) {
      case 'upcoming':
        return appointments.filter(appt => {
          const apptDate = new Date(appt.date);
          return apptDate >= today && (appt.status === 'pending' || appt.status === 'confirmed');
        });
      case 'past':
        return appointments.filter(appt => {
          const apptDate = new Date(appt.date);
          return apptDate < today || appt.status === 'completed' || appt.status === 'cancelled';
        });
      case 'all':
      default:
        return appointments;
    }
  }
  
  async function updateStatus(appointmentId: string, newStatus: 'confirmed' | 'cancelled' | 'completed') {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointmentId);
        
      if (error) {
        console.error('Error updating appointment status:', error);
        return;
      }
      
      // Update local state
      setAppointments(prev => 
        prev.map(appt => 
          appt.id === appointmentId 
            ? { ...appt, status: newStatus } 
            : appt
        )
      );
    } catch (err) {
      console.error('Error:', err);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Appointments</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          {loading ? (
            <div className="text-center py-10">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">No appointments found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {getFilteredAppointments().map((appointment) => (
                <Card key={appointment.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row">
                      <div className="p-4 md:p-6 flex-1">
                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                          <h3 className="font-semibold text-lg">{appointment.patient.name}</h3>
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                            {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-2" />
                            <span>{format(new Date(appointment.date), 'MMMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2" />
                            <span>{appointment.time}</span>
                          </div>
                          {appointment.reason && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-700">Reason:</p>
                              <p className="mt-1">{appointment.reason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 p-4 md:p-6 md:w-64 flex flex-col justify-between">
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-500">Patient Info</p>
                          <p className="text-sm text-gray-600">{appointment.patient.email}</p>
                          <p className="text-sm text-gray-600">{appointment.patient.phone}</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          {appointment.status === 'confirmed' && (
                            <Button 
                              className="w-full" 
                              variant="default"
                              onClick={() => navigate(`/doctor/chat/${appointment.patientId}`)}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Message
                            </Button>
                          )}
                          {appointment.status === 'pending' && (
                            <div className="w-full flex gap-2">
                              <Button className="flex-1" onClick={() => updateStatus(appointment.id, 'confirmed')}>
                                Accept
                              </Button>
                              <Button variant="destructive" onClick={() => updateStatus(appointment.id, 'cancelled')}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {appointment.status === 'completed' && (
                            <Button className="w-full" variant="secondary">
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Notes
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
  
  function getStatusColor(status: string) {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
    }
  }
}
