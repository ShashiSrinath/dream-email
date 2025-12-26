import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEmailStore } from "@/lib/store";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
  Send,
  X,
  Maximize2,
  Minimize2,
  Trash2,
  Paperclip,
  Smile,
  Type,
  MoreVertical,
  Link as LinkIcon,
  Code,
  Eye,
  Strikethrough
} from "lucide-react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const emailSchema = z.object({
  accountId: z.number().min(1, "Select an account"),
  to: z.string().min(1, "Recipient is required"),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  body: z.string(),
});

type EmailFormValues = z.infer<typeof emailSchema>;

const MenuBar = ({ editor, isCodeView, setIsCodeView }: { editor: any, isCodeView: boolean, setIsCodeView: (val: boolean) => void }) => {
  if (!editor) return null;

  const setLink = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const mainButtons = [
    {
      icon: <Type className="w-4 h-4" />,
      title: "Clean Formatting",
      action: () => editor.chain().focus().unsetAllMarks().clearNodes().run(),
    },
    { type: "separator" },
    {
      icon: <Bold className="w-4 h-4" />,
      title: "Bold (Ctrl+B)",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    },
    {
      icon: <Italic className="w-4 h-4" />,
      title: "Italic (Ctrl+I)",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    },
    {
      icon: <UnderlineIcon className="w-4 h-4" />,
      title: "Underline (Ctrl+U)",
      action: () => editor.chain().focus().toggleUnderline().run(),
      isActive: () => editor.isActive('underline'),
    },
    {
      icon: <Strikethrough className="w-4 h-4" />,
      title: "Strikethrough",
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
    },
    { type: "separator" },
    {
      icon: <LinkIcon className="w-4 h-4" />,
      title: "Insert Link",
      action: setLink,
      isActive: () => editor.isActive('link'),
    },
    { type: "separator" },
    {
      icon: <List className="w-4 h-4" />,
      title: "Bullet List",
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    },
    {
      icon: <ListOrdered className="w-4 h-4" />,
      title: "Ordered List",
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    },
    {
      icon: <Quote className="w-4 h-4" />,
      title: "Blockquote",
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    },
  ];

  const historyButtons = [
    {
      icon: <Undo className="w-4 h-4" />,
      title: "Undo",
      action: () => editor.chain().focus().undo().run(),
    },
    {
      icon: <Redo className="w-4 h-4" />,
      title: "Redo",
      action: () => editor.chain().focus().redo().run(),
    },
  ];

  return (
    <div className="flex items-center justify-between p-2 border-t bg-background shrink-0">
      <div className="flex items-center gap-0.5">
        {mainButtons.map((btn, i) => (
          btn.type === "separator" ? (
            <div key={i} className="w-px h-4 bg-border mx-1" />
          ) : (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-8 h-8",
                    btn.isActive?.() ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={btn.action}
                  disabled={isCodeView}
                >
                  {btn.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{btn.title}</TooltipContent>
            </Tooltip>
          )
        ))}
      </div>

      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn("w-8 h-8", isCodeView ? "bg-primary/10 text-primary" : "text-muted-foreground")}
              onClick={() => setIsCodeView(!isCodeView)}
            >
              {isCodeView ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isCodeView ? "Show Preview" : "Show Source Code"}</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border mx-1" />

        {historyButtons.map((btn, i) => (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="w-8 h-8 text-muted-foreground hover:text-foreground"
                onClick={btn.action}
                disabled={isCodeView}
              >
                {btn.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{btn.title}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

interface EmailComposerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultTo?: string;
  defaultCc?: string;
  defaultBcc?: string;
  defaultSubject?: string;
  defaultBody?: string;
  draftId?: number;
}

export function EmailComposer({
  open,
  onOpenChange,
  defaultTo = '',
  defaultCc = '',
  defaultBcc = '',
  defaultSubject = '',
  defaultBody = '',
  draftId: initialDraftId
}: EmailComposerProps) {
  const accounts = useEmailStore(state => state.accounts);
  const [isSending, setIsSending] = useState(false);
  const [draftId, setDraftId] = useState<number | undefined>(initialDraftId);
  const [isSaved, setIsSaved] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCodeView, setIsCodeView] = useState(false);
  const lastSavedRef = useRef<string>("");

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      accountId: accounts[0]?.data.id || 0,
      to: defaultTo,
      cc: defaultCc,
      bcc: defaultBcc,
      subject: defaultSubject,
      body: defaultBody,
    }
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: 'Write your message here...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
    ],
    content: defaultBody,
    onUpdate: ({ editor }) => {
      setValue("body", editor.getHTML(), { shouldDirty: true });
    },
    editorProps: {
      attributes: {
        class: 'prose prose-base focus:outline-none max-w-none p-8 min-h-[400px]',
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
              cc: draft.cc_address || '',
              bcc: draft.bcc_address || '',
              subject: draft.subject || '',
              body: draft.body_html || '',
            });
            editor?.commands.setContent(draft.body_html || '');
            setDraftId(initialDraftId);
            setIsSaved(true);
            if (draft.cc_address) setShowCc(true);
            if (draft.bcc_address) setShowBcc(true);
            lastSavedRef.current = JSON.stringify({
              accountId: draft.account_id,
              to: draft.to_address || '',
              cc: draft.cc_address || '',
              bcc: draft.bcc_address || '',
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
            cc: defaultCc,
            bcc: defaultBcc,
            subject: defaultSubject,
            body: defaultBody,
          });
          editor?.commands.setContent(defaultBody);
          setDraftId(undefined);
          setIsSaved(false);
          setShowCc(!!defaultCc);
          setShowBcc(!!defaultBcc);
          lastSavedRef.current = "";
        }
      };
      initComposer();
    }
  }, [open, initialDraftId, defaultTo, defaultCc, defaultBcc, defaultSubject, defaultBody, reset, editor, accounts]);

  // Watch for changes to trigger autosave
  const formData = watch();

  // Sync editor content if body changes from outside (like code view)
  useEffect(() => {
      if (isCodeView) return; 
      const currentEditorHtml = editor?.getHTML();
      if (formData.body !== currentEditorHtml && formData.body !== undefined) {
          editor?.commands.setContent(formData.body, { emitUpdate: false });
      }
  }, [formData.body, editor, isCodeView]);

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
          cc: formData.cc || null,
          bcc: formData.bcc || null,
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
        cc: data.cc || null,
        bcc: data.bcc || null,
        subject: data.subject,
        body: data.body
      });

      if (draftId) {
        await invoke("delete_draft", { id: draftId });
      }

      toast.success("Email sent");
      onOpenChange?.(false);
    } catch (error) {
      console.error("Failed to send email:", error);
      toast.error(`Failed to send email: ${error}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        showCloseButton={false}
        className={cn(
            "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-300 ease-in-out border-none",
            isMaximized ? "max-w-none w-screen h-screen rounded-none" : "sm:max-w-[900px] h-[800px] rounded-2xl shadow-2xl"
        )}
      >
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/20 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <PenLine className="w-4 h-4" />
            </div>
            <div>
                <DialogTitle className="text-sm font-bold tracking-tight">
                {formData.subject || "New Message"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                    {isSaved ? (
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1 uppercase tracking-widest font-black">
                            <div className="w-1 h-1 rounded-full bg-green-500" />
                            Saved to drafts
                        </span>
                    ) : (
                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black italic opacity-50">
                            Editing...
                        </span>
                    )}
                </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-full transition-colors"
              onClick={() => setIsMaximized(!isMaximized)}
            >
              {isMaximized ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-full transition-colors"
              onClick={handleClose}
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSend)} className="flex flex-col flex-1 min-h-0 bg-background">
          <div className="flex flex-col border-b divide-y shrink-0 px-2">
            {/* From */}
            <div className="flex items-center px-4 py-2.5 group">
              <Label className="w-16 text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">From</Label>
              <Controller
                name="accountId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => field.onChange(parseInt(val))}
                    value={field.value.toString()}
                  >
                    <SelectTrigger className="border-none shadow-none focus:ring-0 h-10 px-0 text-[15px] font-semibold hover:bg-transparent bg-transparent transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      {accounts.map(account => (
                        <SelectItem key={account.data.id} value={account.data.id!.toString()} className="rounded-lg py-2.5">
                          <div className="flex flex-col gap-0.5">
                              <span className="font-bold">{account.data.email}</span>
                              {account.data.name && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{account.data.name}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* To */}
            <div className="flex items-center px-4 py-2.5 gap-3 relative group">
              <Label htmlFor="to" className="w-16 text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">To</Label>
              <Input
                id="to"
                {...register("to")}
                autoFocus
                className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-10 text-[15px] font-medium placeholder:text-muted-foreground/40"
                placeholder="Type recipient email..."
              />
              <div className="flex items-center gap-1.5 opacity-0 group-focus-within:opacity-100 transition-all duration-300 translate-x-2 group-focus-within:translate-x-0">
                {!showCc && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-lg transition-all"
                    onClick={() => setShowCc(true)}
                  >
                    Cc
                  </Button>
                )}
                {!showBcc && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-primary/5 hover:text-primary rounded-lg transition-all"
                    onClick={() => setShowBcc(true)}
                  >
                    Bcc
                  </Button>
                )}
              </div>
              {errors.to && <span className="absolute bottom-1 left-24 text-[10px] text-destructive font-bold">{errors.to.message}</span>}
            </div>

            {/* Cc */}
            {showCc && (
              <div className="flex items-center px-4 py-2.5 gap-3 group animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="cc" className="w-16 text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Cc</Label>
                <Input
                  id="cc"
                  {...register("cc")}
                  className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-10 text-[15px] font-medium"
                  placeholder="Carbon copy"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                    onClick={() => {
                        setValue("cc", "");
                        setShowCc(false);
                    }}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Bcc */}
            {showBcc && (
              <div className="flex items-center px-4 py-2.5 gap-3 group animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="bcc" className="w-16 text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Bcc</Label>
                <Input
                  id="bcc"
                  {...register("bcc")}
                  className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-10 text-[15px] font-medium"
                  placeholder="Blind carbon copy"
                />
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                    onClick={() => {
                        setValue("bcc", "");
                        setShowBcc(false);
                    }}
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center px-4 py-2.5 gap-3 group">
              <Label htmlFor="subject" className="w-16 text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Subject</Label>
              <Input
                id="subject"
                {...register("subject")}
                className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-10 text-[16px] font-bold placeholder:text-muted-foreground/30"
                placeholder="What is this email about?"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isCodeView ? (
                <div className="p-8 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest">HTML Editor</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Directly edit the raw email source</span>
                  </div>
                  <Textarea
                    {...register("body")}
                    className="flex-1 font-mono text-sm p-6 bg-muted/10 border-primary/10 rounded-xl focus-visible:ring-primary/20 min-h-[400px] resize-none leading-relaxed"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <Controller
                  name="body"
                  control={control}
                  render={() => <EditorContent editor={editor} />}
                />
              )}
            </div>

            <MenuBar editor={editor} isCodeView={isCodeView} setIsCodeView={setIsCodeView} />
          </div>

          <div className="p-6 border-t bg-muted/10 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="lg"
                  className="px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] group"
                  disabled={isSending}
                >
                  {isSending ? (
                    <span className="flex items-center gap-3">
                      <div className="w-4 h-4 border-3 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                      Send Message
                    </span>
                  )}
                </Button>

                <div className="w-px h-8 bg-border mx-2" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="w-11 h-11 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                      <Paperclip className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach files</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="w-11 h-11 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all">
                      <Smile className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Insert emoji</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="w-11 h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all rounded-xl"
                      onClick={() => {
                        if (draftId) invoke("delete_draft", { id: draftId });
                        onOpenChange?.(false);
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Discard draft</TooltipContent>
                </Tooltip>

                <Button type="button" variant="ghost" size="icon" className="w-11 h-11 text-muted-foreground hover:bg-accent/50 rounded-xl transition-all">
                    <MoreVertical className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PenLine = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);