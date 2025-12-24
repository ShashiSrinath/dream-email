import { useState, useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEmailStore } from "@/lib/store";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
  Send
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";

const emailSchema = z.object({
  accountId: z.number().min(1, "Select an account"),
  to: z.string().min(1, "Recipient is required").email("Invalid email address"),
  subject: z.string(),
  body: z.string(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap gap-1 p-1 border-b bg-muted/50">
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={editor.isActive('bold') ? 'bg-muted' : ''}
      >
        <Bold className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={editor.isActive('italic') ? 'bg-muted' : ''}
      >
        <Italic className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={editor.isActive('bulletList') ? 'bg-muted' : ''}
      >
        <List className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={editor.isActive('orderedList') ? 'bg-muted' : ''}
      >
        <ListOrdered className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={editor.isActive('blockquote') ? 'bg-muted' : ''}
      >
        <Quote className="w-4 h-4" />
      </Button>
      <div className="w-px h-6 bg-border mx-1" />
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="ghost" size="sm"
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo className="w-4 h-4" />
      </Button>
    </div>
  );
};

interface EmailComposerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  draftId?: number;
}

export function EmailComposer({
  open,
  onOpenChange,
  defaultTo = '',
  defaultSubject = '',
  defaultBody = '',
  draftId: initialDraftId
}: EmailComposerProps) {
  const accounts = useEmailStore(state => state.accounts);
  const [isSending, setIsSending] = useState(false);
  const [draftId, setDraftId] = useState<number | undefined>(initialDraftId);
  const [isSaved, setIsSaved] = useState(false);
  const lastSavedRef = useRef<string>("");

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      accountId: accounts[0]?.data.id || 0,
      to: defaultTo,
      subject: defaultSubject,
      body: defaultBody,
    }
  });

  const editor = useEditor({
    extensions: [StarterKit],
    content: defaultBody,
    onUpdate: ({ editor }) => {
      setValue("body", editor.getHTML(), { shouldDirty: true });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none max-w-none p-4 min-h-[200px]',
      },
    },
  });

  // Load draft or reset on open
  useEffect(() => {
    if (open) {
      const initComposer = async () => {
        if (initialDraftId) {
          try {
            const draft = await invoke<any>("get_draft_by_id", { id: initialDraftId });
            reset({
              accountId: draft.account_id,
              to: draft.to_address || '',
              subject: draft.subject || '',
              body: draft.body_html || '',
            });
            editor?.commands.setContent(draft.body_html || '');
            setDraftId(initialDraftId);
            setIsSaved(true);
            lastSavedRef.current = JSON.stringify({
              accountId: draft.account_id,
              to: draft.to_address || '',
              subject: draft.subject || '',
              body: draft.body_html || '',
            });
          } catch (e) {
            console.error("Failed to fetch draft:", e);
          }
        } else {
          reset({
            accountId: accounts[0]?.data.id || 0,
            to: defaultTo,
            subject: defaultSubject,
            body: defaultBody,
          });
          editor?.commands.setContent(defaultBody);
          setDraftId(undefined);
          setIsSaved(false);
          lastSavedRef.current = "";
        }
      };
      initComposer();
    }
  }, [open, initialDraftId, defaultTo, defaultSubject, defaultBody, reset, editor, accounts]);

  // Watch for changes to trigger autosave
  const formData = watch();
  useEffect(() => {
    if (!open || !formData.accountId) return;

    const currentDataString = JSON.stringify(formData);
    if (currentDataString === lastSavedRef.current) return;

    const timer = setTimeout(async () => {
      if (!formData.to && !formData.subject && (formData.body === '<p></p>' || !formData.body)) return;

      try {
        const id = await invoke<number>("save_draft", {
          id: draftId || null,
          accountId: formData.accountId,
          to: formData.to || null,
          subject: formData.subject || null,
          bodyHtml: formData.body || null
        });
        if (!draftId) setDraftId(id);
        setIsSaved(true);
        lastSavedRef.current = currentDataString;
      } catch (error) {
        console.error("Failed to autosave draft:", error);
      }
    }, 2000);

    return () => {
        clearTimeout(timer);
        setIsSaved(false);
    };
  }, [formData, draftId, open]);

  const onSend = async (data: EmailFormValues) => {
    setIsSending(true);
    try {
      await invoke("send_email", {
        accountId: data.accountId,
        to: data.to,
        subject: data.subject,
        body: data.body
      });

      if (draftId) {
        await invoke("delete_draft", { id: draftId });
      }

      toast.success("Email sent successfully");
      onOpenChange?.(false);
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error(`Failed to send email: ${error}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] h-[600px] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle>New Message</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSend)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 space-y-3 border-b bg-muted/20">
            <div className="flex items-center gap-2">
              <Label htmlFor="accountId" className="w-12 text-muted-foreground">From</Label>
                            <select
                              id="accountId"
                              {...register("accountId", { valueAsNumber: true })}
                              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              {accounts.map(account => (
                                <option key={account.data.id} value={account.data.id}>
                                  {account.data.email}
                                </option>
                              ))}
                            </select>

            </div>

            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <Label htmlFor="to" className="w-12 text-muted-foreground">To</Label>
                    <Input
                        id="to"
                        {...register("to")}
                        className="flex-1 border-none shadow-none focus-visible:ring-0 px-0"
                        placeholder="recipient@example.com"
                    />
                </div>
                {errors.to && <span className="text-[10px] text-destructive ml-14">{errors.to.message}</span>}
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="subject" className="w-12 text-muted-foreground">Subject</Label>
              <Input
                id="subject"
                {...register("subject")}
                className="flex-1 border-none shadow-none focus-visible:ring-0 px-0"
                placeholder="Subject"
              />
            </div>
          </div>

          <MenuBar editor={editor} />

          <div className="flex-1 overflow-y-auto">
            <Controller
              name="body"
              control={control}
              render={() => <EditorContent editor={editor} />}
            />
          </div>

          <DialogFooter className="p-4 border-t bg-muted/20">
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange?.(false)}>
                    Discard
                </Button>
                {isSaved && <span className="text-xs text-muted-foreground">Saved</span>}
                </div>
                <Button type="submit" disabled={isSending}>
                {isSending ? "Sending..." : (
                    <>
                    <Send className="w-4 h-4 mr-2" />
                    Send
                    </>
                )}
                </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
