"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Boxes, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCreateOrganization } from "@/hooks/use-organizations";

const schema = z.object({
  name: z.string().min(2, "Enter a workspace name"),
  slug: z
    .string()
    .min(2, "Enter a workspace URL")
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers, and hyphens only"),
});
type FormValues = z.infer<typeof schema>;

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function OnboardingPage() {
  const router = useRouter();
  const createOrg = useCreateOrganization();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [slugTouched, setSlugTouched] = useState(false);
  const name = watch("name");

  useEffect(() => {
    if (!slugTouched && name) setValue("slug", slugify(name));
  }, [name, slugTouched, setValue]);

  const onSubmit = (values: FormValues) => {
    createOrg.mutate(values, {
      onSuccess: () => router.push("/projects/new"),
    });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 px-4 py-12">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Boxes className="h-4.5 w-4.5" />
        </div>
        <span className="text-lg font-semibold">CloudDeploy</span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>
        <span className="font-medium text-foreground">Create Workspace</span>
        <div className="h-px w-8 bg-border" />
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">2</span>
        <span>Deploy Your First Project</span>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Create your workspace</CardTitle>
          <CardDescription>Projects, deployments, and team members all live inside a workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Organization Name</Label>
              <Input id="name" placeholder="Acme Inc" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="slug">Organization Slug</Label>
              <div className="flex items-center rounded-md border border-input bg-background text-sm">
                <span className="pl-3 text-muted-foreground">clouddeploy.app/</span>
                <input
                  id="slug"
                  className="w-full bg-transparent py-1.5 pr-3 outline-none"
                  {...register("slug", {
                    onChange: () => setSlugTouched(true),
                  })}
                />
              </div>
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
            <Button type="submit" className="w-full" loading={createOrg.isPending}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
