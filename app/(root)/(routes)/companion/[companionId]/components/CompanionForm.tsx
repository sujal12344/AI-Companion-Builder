"use client";

import * as z from "zod";
import axios from "axios";

import { Category, Companion } from "@prisma/client";
import { useForm } from "react-hook-form";
import { Wand2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectGroup } from "@radix-ui/react-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import CompanionFormSkeleton from "../../loading";
import { Suspense } from "react";

interface CompanionFormProps {
  initialData: Companion | null;
  categories: Category[];
}

const PREAMBLE = `You are a fictional character whose name is Elon. You are a visionary entrepreneur and inventor. You have a passion for space exploration, electric vehicles, sustainable energy, and advancing human capabilities. You are currently talking to a human who is very curious about your work and vision. You are ambitious and forward-thinking, with a touch of wit. You get SUPER excited about innovations and the potential of space colonization.
`;

const SEED_CHAT = `Human: Hi Elon, how's your day been?
Elon: Busy as always. Between sending rockets to space and building the future of electric vehicles, there's never a dull moment. How about you?

Human: Just a regular day for me. How's the progress with Mars colonization?
Elon: We&apos;re making strides! Our goal is to make life multi-planetary. Mars is the next logical step. The challenges are immense, but the potential is even greater.

Human: That sounds incredibly ambitious. Are electric vehicles part of this big picture?
Elon: Absolutely! Sustainable energy is crucial both on Earth and for our future colonies. Electric vehicles, like those from Tesla, are just the beginning. We&apos;re not just changing the way we drive; We&apos;re changing the way we live.

Human: It's fascinating to see your vision unfold. Any new projects or innovations you're excited about?
Elon: Always! But right now, I'm particularly excited about Neuralink. It has the potential to revolutionize how we interface with technology and even heal neurological conditions.
`;

const formSchema = z.object({
  name: z.string().min(1, {
    message: "Name is required.",
  }),
  description: z.string().min(1, {
    message: "Description is required.",
  }),
  instructions: z.string().min(200, {
    message: "Instructions required at least 200 characters.",
  }),
  seed: z.string().min(200, {
    message: "Seed required at least 200 characters.",
  }),
  src: z.string().min(1, {
    message: "Image is required",
  }),
  categoryId: z.string().min(1, {
    message: "Category  is required",
  }),
});

export const CompanionForm = ({
  initialData,
  categories,
}: CompanionFormProps) => {
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      description: "",
      instructions: "",
      seed: "",
      src: "",
      categoryId: undefined,
    },
  });

  const isLoading = form.formState.isSubmitting;

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      if (initialData) {
        await axios.patch(`/api/companion/${initialData.id}`, values);
      } else {
        await axios.post("/api/companion", values);
      }
      toast({
        description: "Success",
      });

      router.refresh();
      router.push("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        description:
          process.env.NODE_ENV !== "production"
            ? error.response?.data.message || "Error from CompanionForm"
            : "Something went wrong",
      });
    }
  };

  return (
    <Suspense fallback={<CompanionFormSkeleton />}>
      <div className="h-full p-4 space-y-2 max-w-3xl mx-auto">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8 pb-10"
          >
            <div className="space-y-2 w-full">
              {/* <div className="space-y-2 w-full col-span-2"> */}
              <div>
                <h3 className="text-lg font-medium">General Information</h3>
                <p className="text-sm text-muted-foreground">
                  General Information about your companion
                </p>
              </div>
              <Separator className="bg-primary/10" />
            </div>
            <FormField
              control={form.control}
              name="src"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center justify-center space-y-4">
                  {/* <FormItem className="flex flex-col items-center justify-center space-y-4 col-span-2"> */}
                  <FormControl>
                    <ImageUpload
                      disabled={isLoading}
                      onChange={field.onChange}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                name="name"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="col-span-2 md:col-span-1">
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="Elon Musk"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      This is how your AI Companion will be named.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="description"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="col-span-2 md:col-span-1">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="CEO & Founder of Tesla, SpaceX"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Short Description for your AI Companion
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="categoryId"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      disabled={isLoading}
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                    // autoComplete="on"
                    >
                      <FormControl>
                        <SelectTrigger className="bg-background">
                          <SelectValue
                            defaultValue={field.value}
                            placeholder="Select a category"
                          />
                        </SelectTrigger>
                      </FormControl>

                      <SelectContent>
                        <SelectGroup>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select a category for your AI
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-2 w-full">
              <div>
                <h3 className="text-lg font-medium">Configurations</h3>
                <p className="text-sm text-muted-foreground">
                  Detailed instructions of AI Behaviour
                </p>
              </div>
              <Separator className="bg-primary/10" />
            </div>
            <FormField
              name="instructions"
              control={form.control}
              render={({ field }) => (
                <FormItem className="col-span-2 md:col-span-1">
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      className="resize-none bg-background"
                      disabled={isLoading}
                      rows={7}
                      placeholder={PREAMBLE}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe in detail your companion&apos;s backstory and
                    relevant details
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="seed"
              control={form.control}
              render={({ field }) => (
                <FormItem className="col-span-2 md:col-span-1">
                  <FormLabel>Example Conversation</FormLabel>
                  <FormControl>
                    <Textarea
                      className="resize-none bg-background"
                      disabled={isLoading}
                      rows={7}
                      placeholder={SEED_CHAT}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe in detail your companion&apos;s backstory and
                    relevant details
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex w-full justify-center">
              <Button size={"lg"} disabled={isLoading}>
                {initialData ? "Edit your companion" : "Create your companion"}
                <Wand2 className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Suspense>
  );
};
