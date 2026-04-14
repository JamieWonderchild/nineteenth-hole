"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Categories are managed within the products page
export default function POSCategoriesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/manage/pos/products");
  }, [router]);
  return null;
}
