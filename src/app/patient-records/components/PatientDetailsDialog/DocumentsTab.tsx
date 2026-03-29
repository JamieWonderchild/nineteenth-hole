'use client';

import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PlusCircle } from 'lucide-react';

export function DocumentsTab() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Documents & Files</CardTitle>
          <Button size="sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            Upload
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-center p-6 text-gray-500">
          <p>No documents available yet</p>
        </div>
      </CardContent>
    </Card>
  );
}
