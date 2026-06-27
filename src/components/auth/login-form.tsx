"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Chrome } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Welcome back!");
    router.push(redirectTo);
    router.refresh();
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      toast.error(error.message);
      setIsGoogleLoading(false);
    }
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          Welcome back
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Sign in to your Clutch AI account
        </p>
      </div>

      {/* Google OAuth */}
      <button
        id="login-google-btn"
        onClick={handleGoogleLogin}
        disabled={isGoogleLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-medium text-sm mb-6 transition-all hover:opacity-90 disabled:opacity-50"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        {isGoogleLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Chrome className="w-4 h-4" />
        )}
        Continue with Google
      </button>

      {/* Divider */}
      <div className="relative flex items-center mb-6">
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        <span className="mx-3 text-xs" style={{ color: "var(--text-muted)" }}>
          or continue with email
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Email
          </label>
          <input
            id="login-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register("email")}
            className="w-full px-4 py-3 rounded-xl text-sm transition-all"
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

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <Link href="/forgot-password" className="text-xs" style={{ color: "var(--primary)" }}>
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="current-password"
              {...register("password")}
              className="w-full px-4 py-3 pr-12 rounded-xl text-sm transition-all"
              style={{
                background: "var(--surface-raised)",
                border: `1px solid ${errors.password ? "var(--danger)" : "var(--border)"}`,
                color: "var(--text-primary)",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <motion.button
          id="login-submit-btn"
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-2 transition-all disabled:opacity-50"
          style={{ background: "var(--primary)", color: "white" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </motion.button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
        Don&apos;t have an account?{" "}
        <Link href="/signup" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sign up free
        </Link>
      </p>
    </motion.div>
  );
}
