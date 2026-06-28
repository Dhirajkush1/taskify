"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Chrome } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const signupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[0-9]/, "Must contain a number"),
});

type SignupForm = z.infer<typeof signupSchema>;

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupForm) => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const locale = navigator.language || "en-US";
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { 
          full_name: data.fullName,
          timezone,
          locale
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Check your email to confirm your account!");
    router.push("/login?verified=pending");
  };

  const handleGoogleSignup = async () => {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
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
          Create your account
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Start beating deadlines with AI. Free forever.
        </p>
      </div>

      {/* Google */}
      <button
        id="signup-google-btn"
        onClick={handleGoogleSignup}
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
          or with email
        </span>
        <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Full Name
          </label>
          <input
            id="signup-name"
            type="text"
            placeholder="Alex Johnson"
            autoComplete="name"
            {...register("fullName")}
            className="w-full px-4 py-3 rounded-xl text-sm"
            style={{
              background: "var(--surface-raised)",
              border: `1px solid ${errors.fullName ? "var(--danger)" : "var(--border)"}`,
              color: "var(--text-primary)",
            }}
          />
          {errors.fullName && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }}>
              {errors.fullName.message}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
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

        {/* Password */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            Password
          </label>
          <div className="relative">
            <input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              autoComplete="new-password"
              {...register("password")}
              className="w-full px-4 py-3 pr-12 rounded-xl text-sm"
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

        <motion.button
          id="signup-submit-btn"
          type="submit"
          disabled={isSubmitting}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
          style={{ background: "var(--primary)", color: "white" }}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Creating account...
            </>
          ) : (
            "Create Free Account"
          )}
        </motion.button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: "var(--text-muted)" }}>
        Already have an account?{" "}
        <Link href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
          Sign in
        </Link>
      </p>

      <p className="text-center text-xs mt-3" style={{ color: "var(--text-disabled)" }}>
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>
    </motion.div>
  );
}
