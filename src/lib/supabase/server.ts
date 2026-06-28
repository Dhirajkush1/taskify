import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function createClient(): Promise<
  SupabaseClient<Database, "public", "public", Database["public"]>
> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                domain: options.domain,
                path: options.path,
                maxAge: options.maxAge,
                secure: options.secure,
                httpOnly: options.httpOnly,
                sameSite: options.sameSite,
                expires: options.expires,
              });
            });
          } catch {
            // Server component — cookies can't be set, ignore
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database, "public", "public", Database["public"]>;
}
