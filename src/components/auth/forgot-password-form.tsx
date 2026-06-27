"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Please enter a valid email"),
});
type ForgotForm = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: ForgotForm) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSent(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative p-8 rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {sent ? (
        <div className="text-center py-4">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
            Check your inbox
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            We&apos;ve sent a password reset link to your email address.
          </p>
          <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.875rem" }}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Reset password
            </h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className="w-full px-4 py-3 rounded-xl text-sm"
                style={{
                  background: "var(--surface-raised)",
                  border: `1px solid ${errors.email ? "var(--danger)" : "var(--border)"}`,
                  color: "var(--text-primary)",
                }}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            <motion.button
              id="forgot-submit-btn"
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: "var(--primary)", color: "white" }}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                "Send Reset Link"
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
            <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </motion.div>
  );
}
