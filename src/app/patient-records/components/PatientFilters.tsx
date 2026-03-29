'use client';

import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface PatientFiltersProps {
  filterDialogOpen: boolean;
  setFilterDialogOpen: (open: boolean) => void;
}

export function PatientFilters({
  filterDialogOpen,
  setFilterDialogOpen,
}: PatientFiltersProps) {
  return (
    <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex whitespace-nowrap">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Filter Patients</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">No filters available.</p>
        </div>
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={() => setFilterDialogOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
