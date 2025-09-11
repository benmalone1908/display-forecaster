
import { toast as sonnerToast } from "sonner";

// Define the ToasterToast type directly in this file
export interface ToasterToast {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "default" | "destructive";
}

// Create a simple useToast implementation
export const useToast = () => {
  return {
    toasts: [] as ToasterToast[],
    dismiss: (toastId?: string) => {},
    toast: (props: ToasterToast) => {}
  };
};

// Create a toast function that matches the expected interface
export const toast = sonnerToast;
