"use client";

import z from "zod";
import axios from "axios";

import { Companion } from "@prisma/client";
import { useForm } from "react-hook-form";
import { Wand2, Sparkles, User, FileText, Loader2, Bot } from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import ImageUpload from "@/components/ImageUpload";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import CompanionFormSkeleton from "../../loading";
import { Suspense, useState } from "react";
import errorResponse from "@/lib/errorResponse";
import { SourceList } from "@/components/sources/SourceList";
import { AddSourceDialog } from "@/components/sources/AddSourceDialog";

interface CompanionFormProps {
  initialData: Companion | null;
  initialSources?: any[];
}

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required.",
  }).trim(),
  description: z.string().min(1, {
    message: "Description is required.",
  }).trim(),
  instructions: z.string().optional(),
  seed: z.string().optional(),
  img: z.string().min(1, {
    message: "Image is required",
  }).trim(),
});

export const CompanionForm = ({
  initialData,
  initialSources = [],
}: CompanionFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceListKey, setSourceListKey] = useState(0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          name: initialData.name,
          description: initialData.description,
          instructions: initialData.instructions || "",
          seed: initialData.seed || "",
          img: initialData.img,
        }
      : {
          name: "",
          description: "",
          instructions: "",
          seed: "",
          img: "",
        },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const formData = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        formData.append(key, value as string);
      });

      if (initialData) {
        await axios.patch(`/api/companion/${initialData.id}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        await axios.post("/api/companion", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }

      toast({ description: "Success" });
      router.refresh();
      router.push("/");
    } catch (error) {
      errorResponse(error);
    }
  };

  return (
    <Suspense fallback={<CompanionFormSkeleton />}>
      <div className="h-full p-4 space-y-6 max-w-4xl mx-auto">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="rounded-2xl border border-border/70 bg-card/50 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-6"
          >
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-border/50">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-inner">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  <span>General Information</span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary/80 text-muted-foreground font-normal">
                    Identity
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Set up the visual appearance, name, and role description of your AI companion
                </p>
              </div>
            </div>

            {/* Avatar Upload */}
            <FormField
              control={form.control}
              name="img"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center justify-center">
                  <FormControl>
                    <ImageUpload
                      disabled={isLoading}
                      onChange={field.onChange}
                      value={field.value}
                      key={field.name}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name & Description Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span>Name</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="e.g. Piyush Garg AI"
                        className="h-10 text-sm bg-background/60 border-border/70 focus-visible:ring-primary/30"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      This is how your AI Companion will be named and addressed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <span>Description</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="e.g. Software Engineer, Educator & YouTuber"
                        className="h-10 text-sm bg-background/60 border-border/70 focus-visible:ring-primary/30"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px]">
                      A short summary of what this companion represents.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit Action Button */}
            <div className="flex w-full justify-end pt-4 border-t border-border/40">
              <Button
                type="submit"
                size="lg"
                disabled={isLoading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 px-6 rounded-xl shadow-md transition-all gap-2 text-xs sm:text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving changes...</span>
                  </>
                ) : (
                  <>
                    <span>{initialData ? "Save Companion Changes" : "Create AI Companion"}</span>
                    <Wand2 className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Knowledge & Social Sources Section (Decoupled from Companion General Form) */}
        <div className="space-y-4 pt-6">
          <div className="space-y-2 w-full">
            <div>
              <h3 className="text-lg font-medium">Knowledge & Social Sources</h3>
              <p className="text-sm text-muted-foreground">
                Connect YouTube channels and social platforms to power your companion with real knowledge
              </p>
            </div>
            <Separator className="bg-primary/10" />
          </div>

          {initialData ? (
            <div className="border rounded-lg p-4">
              <SourceList
                key={sourceListKey}
                companionId={initialData.id}
                initialSources={initialSources}
                onAddSource={() => setShowAddSource(true)}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              You can connect YouTube channels, social profiles, and knowledge sources right after creating your companion.
            </p>
          )}
        </div>

        {initialData && (
          <AddSourceDialog
            open={showAddSource}
            onOpenChange={setShowAddSource}
            companionId={initialData.id}
            onSourceAdded={() => {
              setSourceListKey((prev) => prev + 1);
            }}
          />
        )}
      </div>
    </Suspense>
  );
};
