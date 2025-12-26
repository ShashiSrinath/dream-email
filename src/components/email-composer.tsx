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
      icon: <Bold className="w-4 h-4" />,
      title: "Bold",
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    },
    {
      icon: <Italic className="w-4 h-4" />,
      title: "Italic",
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    },
    {
      icon: <UnderlineIcon className="w-4 h-4" />,
      title: "Underline",
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
    { type: "separator" },
    {
      icon: <Quote className="w-4 h-4" />,
      title: "Blockquote",
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    },
    {
      icon: <LinkIcon className="w-4 h-4" />,
      title: "Insert Link",
      action: setLink,
      isActive: () => editor.isActive('link'),
    },
  ];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/5 shadow-[0_-1px_0_0_rgba(0,0,0,0.02)] shrink-0">
      <div className="flex items-center gap-1">
        {mainButtons.map((btn, i) => (
          btn.type === "separator" ? (
            <div key={i} className="w-px h-4 bg-border/60 mx-1" />
          ) : (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "w-8 h-8 rounded-lg transition-all duration-200",
                    btn.isActive?.() 
                      ? "bg-primary/10 text-primary hover:bg-primary/20" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  onClick={btn.action}
                  disabled={isCodeView}
                >
                  {btn.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">{btn.title}</TooltipContent>
            </Tooltip>
          )
        ))}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "w-8 h-8 rounded-lg transition-all duration-200", 
                isCodeView ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              onClick={() => setIsCodeView(!isCodeView)}
            >
              {isCodeView ? <Eye className="w-4 h-4" /> : <Code className="w-4 h-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">
            {isCodeView ? "Show Preview" : "Show Source"}
          </TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-border/60 mx-1" />

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={isCodeView}
              >
                <Undo className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={isCodeView}
              >
                <Redo className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">Redo</TooltipContent>
          </Tooltip>
        </div>
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
        class: 'prose prose-sm sm:prose-base focus:outline-none max-w-none px-12 py-10 min-h-[450px] font-sans selection:bg-primary/20',
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
            "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] border-none shadow-2xl",
            isMaximized ? "max-w-none w-screen h-screen rounded-none" : "sm:max-w-[950px] h-[850px] rounded-[24px]"
        )}
      >
        <DialogHeader className="px-12 py-6 border-b flex flex-row items-center justify-between space-y-0 bg-background shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
                <PenLine className="w-5 h-5" />
            </div>
            <div>
                <DialogTitle className="text-[17px] font-bold tracking-tight text-foreground/90">
                {formData.subject || "New Message"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                    {isSaved ? (
                        <div className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5 uppercase tracking-[0.1em] font-bold">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                            Saved to drafts
                        </div>
                    ) : (
                        <div className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.1em] font-bold animate-pulse">
                            Editing...
                        </div>
                    )}
                </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-xl transition-all duration-200"
              onClick={() => setIsMaximized(!isMaximized)}
            >
              {isMaximized ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground/70 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all duration-200"
              onClick={handleClose}
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSend)} className="flex flex-col flex-1 min-h-0 bg-background">
          <div className="flex flex-col border-b divide-y divide-border/40 shrink-0 px-1">
            {/* From */}
            <div className="flex items-center px-12 py-2 gap-4 group transition-colors hover:bg-muted/30">
              <Label className="w-16 text-[11px] font-medium uppercase tracking-wider text-foreground/50">From</Label>
              <Controller
                name="accountId"
                control={control}
                render={({ field }) => (
                  <Select
                    onValueChange={(val) => field.onChange(parseInt(val))}
                    value={field.value.toString()}
                  >
                    <SelectTrigger className="border-none shadow-none focus:ring-0 h-12 px-0 text-[14px] font-medium hover:bg-transparent bg-transparent transition-all">
                      <div className="flex items-center gap-2 text-left">
                        {accounts.find(a => a.data.id === field.value)?.data.name && (
                          <span className="font-semibold text-foreground">
                            {accounts.find(a => a.data.id === field.value)?.data.name}
                          </span>
                        )}
                        <span className={cn(
                          "text-muted-foreground font-normal",
                          accounts.find(a => a.data.id === field.value)?.data.name ? "text-xs opacity-70" : "text-[14px]"
                        )}>
                          &lt;{accounts.find(a => a.data.id === field.value)?.data.email}&gt;
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border border-border/40 shadow-2xl p-1.5 min-w-[300px]">
                      {accounts.map(account => (
                        <SelectItem key={account.data.id} value={account.data.id!.toString()} className="rounded-xl py-2.5 px-3 focus:bg-primary/5 focus:text-primary transition-colors cursor-pointer">
                          <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                {account.data.picture ? (
                                  <img src={account.data.picture} className="w-full h-full rounded-full" alt="" />
                                ) : (
                                  account.data.email[0].toUpperCase()
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-sm tracking-tight truncate">{account.data.name || 'No Name'}</span>
                                  <span className="text-xs text-muted-foreground truncate">{account.data.email}</span>
                              </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* To */}
            <div className="flex items-center px-12 py-2 gap-4 relative group transition-colors hover:bg-muted/30">
              <Label htmlFor="to" className="w-16 text-[11px] font-medium uppercase tracking-wider text-foreground/50">To</Label>
              <Input
                id="to"
                {...register("to")}
                autoFocus
                className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-12 text-[14px] font-medium placeholder:text-muted-foreground/30 transition-all"
                placeholder="recipient@example.com"
              />
              <div className="flex items-center gap-1 opacity-0 group-focus-within:opacity-100 transition-all duration-300 translate-x-2 group-focus-within:translate-x-0">
                {!showCc && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:bg-primary/5 hover:text-primary rounded-lg transition-all"
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
                    className="h-7 px-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:bg-primary/5 hover:text-primary rounded-lg transition-all"
                    onClick={() => {
                        setShowBcc(true);
                    }}
                  >
                    Bcc
                  </Button>
                )}
              </div>
              {errors.to && <span className="absolute bottom-1 left-32 text-[9px] text-destructive font-bold uppercase tracking-tighter">{errors.to.message}</span>}
            </div>

            {/* Cc */}
            {showCc && (
              <div className="flex items-center px-12 py-2 gap-4 group animate-in fade-in slide-in-from-top-1 duration-300 transition-colors hover:bg-muted/30">
                <Label htmlFor="cc" className="w-16 text-[11px] font-medium uppercase tracking-wider text-foreground/50">Cc</Label>
                <Input
                  id="cc"
                  {...register("cc")}
                  className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-12 text-[14px] font-medium placeholder:text-muted-foreground/30"
                  placeholder="carbon-copy@example.com"
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
              <div className="flex items-center px-12 py-2 gap-4 group animate-in fade-in slide-in-from-top-1 duration-300 transition-colors hover:bg-muted/30">
                <Label htmlFor="bcc" className="w-16 text-[11px] font-medium uppercase tracking-wider text-foreground/50">Bcc</Label>
                <Input
                  id="bcc"
                  {...register("bcc")}
                  className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-12 text-[14px] font-medium placeholder:text-muted-foreground/30"
                  placeholder="blind-carbon-copy@example.com"
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
            <div className="flex items-center px-12 py-2 gap-4 group transition-colors hover:bg-muted/30">
              <Label htmlFor="subject" className="w-16 text-[11px] font-medium uppercase tracking-wider text-foreground/50">Subject</Label>
              <Input
                id="subject"
                {...register("subject")}
                className="flex-1 border-none shadow-none focus-visible:ring-0 px-0 h-12 text-[15px] font-bold placeholder:text-muted-foreground/20 tracking-tight"
                placeholder="What's this about?"
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {isCodeView ? (
                <div className="p-12 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                          <Code className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-[0.1em] text-foreground/80 block">HTML Source</span>
                          <span className="text-[10px] text-muted-foreground font-medium">Directly edit raw email code</span>
                        </div>
                      </div>
                  </div>
                  <Textarea
                    {...register("body")}
                    className="flex-1 font-mono text-[13px] p-8 bg-muted/20 border-border/40 rounded-2xl focus-visible:ring-primary/20 min-h-[400px] resize-none leading-relaxed shadow-inner"
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className="px-0">
                  <Controller
                    name="body"
                    control={control}
                    render={() => <EditorContent editor={editor} />}
                  />
                </div>
              )}
            </div>

            <MenuBar editor={editor} isCodeView={isCodeView} setIsCodeView={setIsCodeView} />
          </div>

          <div className="px-12 py-8 border-t bg-muted/5 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="px-10 h-14 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-[20px] shadow-xl shadow-primary/20 transition-all active:scale-[0.97] group relative overflow-hidden"
                  disabled={isSending}
                >
                  {isSending ? (
                    <span className="flex items-center gap-3">
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-3">
                      <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                      <span>Send Message</span>
                    </span>
                  )}
                </Button>

                <div className="w-px h-8 bg-border/40 mx-3" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="w-12 h-12 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-2xl transition-all duration-300">
                      <Paperclip className="w-5.5 h-5.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">Attach files</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="w-12 h-12 text-muted-foreground/70 hover:text-primary hover:bg-primary/10 rounded-2xl transition-all duration-300">
                      <Smile className="w-5.5 h-5.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">Add emoji</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="w-12 h-12 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all duration-300 rounded-2xl"
                      onClick={() => {
                        if (draftId) invoke("delete_draft", { id: draftId });
                        onOpenChange?.(false);
                      }}
                    >
                      <Trash2 className="w-5.5 h-5.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-[10px] font-bold uppercase tracking-wider">Discard</TooltipContent>
                </Tooltip>

                <Button type="button" variant="ghost" size="icon" className="w-12 h-12 text-muted-foreground/40 hover:bg-muted rounded-2xl transition-all duration-300">
                    <MoreVertical className="w-5.5 h-5.5" />
                </Button>
              </div>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}