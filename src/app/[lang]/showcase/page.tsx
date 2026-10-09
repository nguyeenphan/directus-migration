import {
  Bold,
  Check,
  ChevronsUpDown,
  Info,
  Italic,
  Trash2,
  TriangleAlert,
  Underline,
  X,
} from 'lucide-react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { CountChip } from '@/components/common/countChip';
import { DiffMark } from '@/components/common/diffMark';
import { ThemeToggle } from '@/components/layout/themeToggle';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TranslationProvider } from '@/contexts/translationContext';
import { getDictionary } from '@/lib/i18n/dictionary';
import { isLocale } from '@/models/common';
import type { TChangeKind } from '@/models/plan';

import { SummaryTile } from '../migrate/components/apply/step/summaryTile';
import { StatusBanner } from '../migrate/components/connect/gate/statusBanner';
import { CopyDemo } from './copyDemo';

const BUTTON_VARIANTS = [
  'default',
  'outline',
  'secondary',
  'destructive',
  'ghost',
  'link',
] as const;

const BUTTON_SIZES = ['xs', 'sm', 'default', 'lg'] as const;
const ICON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;

const BADGE_VARIANTS = [
  'default',
  'secondary',
  'destructive',
  'outline',
  'ghost',
  'link',
] as const;

const CHANGE_KINDS: TChangeKind[] = [
  'add',
  'modify',
  'delete',
  'unchanged',
  'conflict',
  'blocked',
];

const ENVIRONMENTS = [
  { label: 'Production', value: 'production' },
  { label: 'Staging', value: 'staging' },
  { label: 'Local', value: 'local' },
];

const ROWS = [
  { collection: 'articles', add: 10, modify: 30, remove: 4 },
  { collection: 'authors', add: 1, modify: 1, remove: 0 },
  { collection: 'categories', add: 3, modify: 0, remove: 0 },
];

const LOG_LINES = Array.from(
  { length: 20 },
  (_, index) =>
    `15:44:${String(index).padStart(2, '0')} data: wrote batch ${index + 1}`,
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section
    id={title.toLowerCase().replaceAll(' ', '-')}
    className="flex flex-col gap-3"
  >
    <h2 className="text-lg">{title}</h2>
    <div className="flex flex-col gap-4 rounded-base border-2 bg-secondary-background p-4">
      {children}
    </div>
  </section>
);

const Row = ({ label, children }: { label?: string; children: ReactNode }) => (
  <div className="flex flex-col gap-2">
    {label ? (
      <p className="text-xs tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
    ) : null}
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </div>
);

// ponytail: dev-only review page, copy is hardcoded English instead of going through the dictionaries
const ShowcasePage = async ({
  params,
}: {
  params: Promise<{ lang: string }>;
}) => {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <TranslationProvider locale={lang} dictionary={await getDictionary(lang)}>
      <TooltipProvider>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
            <header className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-heading">Component showcase</h1>
                <p className="text-sm text-muted-foreground">
                  Every component in src/components, in the neobrutalism theme.
                </p>
              </div>
              <ThemeToggle />
            </header>

            <Section title="Typography">
              <Row label="Be Vietnam Pro — 500 base, 900 heading">
                <div className="flex flex-col gap-2">
                  <p className="text-xl font-heading">Page title — text-xl</p>
                  <p className="text-lg font-heading">
                    Section title — text-lg
                  </p>
                  <p className="text-base font-heading">
                    Card title — text-base
                  </p>
                  <p className="text-sm">Body copy — text-sm, font-base</p>
                  <p className="text-sm text-muted-foreground">
                    Secondary copy — text-sm, muted
                  </p>
                  <p className="text-xs font-heading tracking-wide text-muted-foreground uppercase">
                    Group label — text-xs
                  </p>
                </div>
              </Row>
              <Row label="System mono — data values">
                <div className="identifier flex flex-col gap-2">
                  <p className="text-sm">article_translations.languages_code</p>
                  <p className="text-xs text-muted-foreground">
                    0f8fad5b-d9cb-469f-a165-70867728950e -&gt; 0O 1lI
                  </p>
                </div>
              </Row>
            </Section>

            <Section title="Button">
              {BUTTON_VARIANTS.map((variant) => (
                <Row key={variant} label={variant}>
                  {BUTTON_SIZES.map((size) => (
                    <Button key={size} variant={variant} size={size}>
                      <Check /> {size}
                    </Button>
                  ))}
                  {ICON_SIZES.map((size) => (
                    <Button
                      key={size}
                      variant={variant}
                      size={size}
                      aria-label={`${variant} ${size}`}
                    >
                      <Trash2 />
                    </Button>
                  ))}
                  <Button variant={variant} disabled>
                    disabled
                  </Button>
                </Row>
              ))}
            </Section>

            <Section title="Badge">
              <Row>
                {BADGE_VARIANTS.map((variant) => (
                  <Badge key={variant} variant={variant}>
                    {variant}
                  </Badge>
                ))}
                <Badge>
                  <Check /> with icon
                </Badge>
              </Row>
            </Section>

            <Section title="Form">
              <Row label="Input">
                <div className="flex w-64 flex-col gap-1.5">
                  <Label htmlFor="showcase-url">Base URL</Label>
                  <Input
                    id="showcase-url"
                    placeholder="https://cms.example.com"
                  />
                </div>
                <div className="flex w-64 flex-col gap-1.5">
                  <Label htmlFor="showcase-invalid">Invalid</Label>
                  <Input
                    id="showcase-invalid"
                    aria-invalid
                    defaultValue="not a url"
                  />
                </div>
                <div className="flex w-64 flex-col gap-1.5">
                  <Label htmlFor="showcase-disabled">Disabled</Label>
                  <Input
                    id="showcase-disabled"
                    disabled
                    defaultValue="read only"
                  />
                </div>
              </Row>
              <Row label="Select">
                <Select items={ENVIRONMENTS} defaultValue="staging">
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Environment</SelectLabel>
                      {ENVIRONMENTS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectSeparator />
                    <SelectItem value="disabled" disabled>
                      Disabled
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Select items={ENVIRONMENTS} defaultValue="local">
                  <SelectTrigger size="sm" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENVIRONMENTS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
              <Row label="Checkbox">
                <Label>
                  <Checkbox /> Unchecked
                </Label>
                <Label>
                  <Checkbox defaultChecked /> Checked
                </Label>
                <Label>
                  <Checkbox disabled /> Disabled
                </Label>
                <Label>
                  <Checkbox defaultChecked disabled /> Checked, disabled
                </Label>
              </Row>
              <Row label="Toggle">
                <Toggle aria-label="Bold">
                  <Bold />
                </Toggle>
                <Toggle defaultPressed aria-label="Italic">
                  <Italic />
                </Toggle>
                <Toggle variant="outline">Outline</Toggle>
                <Toggle variant="outline" defaultPressed>
                  Outline, pressed
                </Toggle>
                <Toggle variant="outline" size="sm">
                  Small
                </Toggle>
              </Row>
              <Row label="Toggle group">
                <ToggleGroup defaultValue={['bold']}>
                  <ToggleGroupItem value="bold" aria-label="Bold">
                    <Bold />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="italic" aria-label="Italic">
                    <Italic />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="underline" aria-label="Underline">
                    <Underline />
                  </ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup
                  variant="outline"
                  spacing={0}
                  defaultValue={['inline']}
                >
                  <ToggleGroupItem value="inline">Inline</ToggleGroupItem>
                  <ToggleGroupItem value="split">Side by side</ToggleGroupItem>
                  <ToggleGroupItem value="raw">Raw</ToggleGroupItem>
                </ToggleGroup>
              </Row>
            </Section>

            <Section title="Tabs">
              <Tabs defaultValue="schema">
                <TabsList>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                  <TabsTrigger value="disabled" disabled>
                    Disabled
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="schema">Schema tab content.</TabsContent>
                <TabsContent value="data">Data tab content.</TabsContent>
              </Tabs>
              <Tabs defaultValue="schema">
                <TabsList variant="line">
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                </TabsList>
                <TabsContent value="schema">Line variant, schema.</TabsContent>
                <TabsContent value="data">Line variant, data.</TabsContent>
              </Tabs>
            </Section>

            <Section title="Card">
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Source</CardTitle>
                    <CardDescription>directus.example.com</CardDescription>
                    <CardAction>
                      <Badge>11.5.1</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    6 collections, admin access confirmed.
                  </CardContent>
                  <CardFooter className="gap-2">
                    <Button size="sm">Test connection</Button>
                    <Button size="sm" variant="outline">
                      Cancel
                    </Button>
                  </CardFooter>
                </Card>
                <Card size="sm">
                  <CardHeader>
                    <CardTitle>Small card</CardTitle>
                    <CardDescription>No footer.</CardDescription>
                  </CardHeader>
                  <CardContent>Compact spacing.</CardContent>
                </Card>
              </div>
            </Section>

            <Section title="Alert">
              <Alert>
                <Info />
                <AlertTitle>Versions match</AlertTitle>
                <AlertDescription>Ready to migrate.</AlertDescription>
                <AlertAction>
                  <Button size="xs" variant="outline">
                    Undo
                  </Button>
                </AlertAction>
              </Alert>
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>The token is not valid</AlertTitle>
                <AlertDescription>
                  The token has expired or was mistyped.
                </AlertDescription>
              </Alert>
            </Section>

            <Section title="Overlays">
              <Row>
                <Dialog>
                  <DialogTrigger render={<Button variant="outline" />}>
                    Dialog
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>SQL script</DialogTitle>
                      <DialogDescription>
                        Review the statements before running them.
                      </DialogDescription>
                    </DialogHeader>
                    <pre className="identifier overflow-auto rounded-base border-2 bg-muted p-3 text-xs">
                      ALTER TABLE &quot;articles&quot; ADD COLUMN
                      &quot;summary&quot; text;
                    </pre>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger render={<Button variant="destructive" />}>
                    Alert dialog
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogMedia>
                        <TriangleAlert />
                      </AlertDialogMedia>
                      <AlertDialogTitle>Write to target.test</AlertDialogTitle>
                      <AlertDialogDescription>
                        53 records will be written. This cannot be undone
                        automatically.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction>Apply</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Sheet>
                  <SheetTrigger render={<Button variant="outline" />}>
                    Sheet
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>Run log</SheetTitle>
                      <SheetDescription>
                        Everything the run printed.
                      </SheetDescription>
                    </SheetHeader>
                    <SheetFooter>
                      <Button>Close</Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>

                <Tooltip>
                  <TooltipTrigger render={<Button variant="outline" />}>
                    Tooltip
                  </TooltipTrigger>
                  <TooltipContent>
                    Blocked until both sides connect
                  </TooltipContent>
                </Tooltip>
              </Row>
            </Section>

            <Section title="Progress">
              <Progress value={0} />
              <Progress value={42} />
              <Progress value={100} />
            </Section>

            <Section title="Table">
              <Table>
                <TableCaption>Rows to write per collection.</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Collection</TableHead>
                    <TableHead className="text-right">Add</TableHead>
                    <TableHead className="text-right">Modify</TableHead>
                    <TableHead className="text-right">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ROWS.map((row) => (
                    <TableRow key={row.collection}>
                      <TableCell className="identifier">
                        {row.collection}
                      </TableCell>
                      <TableCell className="text-right">{row.add}</TableCell>
                      <TableCell className="text-right">{row.modify}</TableCell>
                      <TableCell className="text-right">{row.remove}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">14</TableCell>
                    <TableCell className="text-right">31</TableCell>
                    <TableCell className="text-right">4</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </Section>

            <Section title="Layout">
              <Row label="Separator">
                <span>Source</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Target</span>
              </Row>
              <Separator />
              <Row label="Collapsible">
                <Collapsible className="w-full">
                  <CollapsibleTrigger
                    render={<Button variant="ghost" size="sm" />}
                  >
                    <ChevronsUpDown /> 4 unchanged fields
                  </CollapsibleTrigger>
                  <CollapsibleContent className="identifier pt-2 text-sm">
                    id, slug, author, status
                  </CollapsibleContent>
                </Collapsible>
              </Row>
              <Row label="Scroll area">
                <ScrollArea className="h-32 w-full rounded-base border-2">
                  <div className="identifier p-2 text-xs">
                    {LOG_LINES.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </ScrollArea>
              </Row>
              <Row label="Resizable">
                <ResizablePanelGroup className="h-32 w-full gap-2">
                  <ResizablePanel defaultSize={35} minSize={20}>
                    <div className="flex h-full items-center justify-center rounded-base border-2">
                      List
                    </div>
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={65} minSize={20}>
                    <div className="flex h-full items-center justify-center rounded-base border-2">
                      Detail
                    </div>
                  </ResizablePanel>
                </ResizablePanelGroup>
              </Row>
            </Section>

            <Section title="App components">
              <Row label="Diff mark and count chip">
                {CHANGE_KINDS.map((kind) => (
                  <span key={kind} className="flex items-center gap-1 text-sm">
                    <DiffMark kind={kind} label={kind} />
                    {kind}
                  </span>
                ))}
              </Row>
              <Row>
                <CountChip kind="add" value={10} label="added" />
                <CountChip kind="modify" value={30} label="modified" />
                <CountChip kind="delete" value={4} label="deleted" />
                <CountChip kind="add" value={0} label="none" />
                <CountChip kind="modify" value={null} label="unknown" />
              </Row>
              <Row label="Copy button">
                <CopyDemo />
              </Row>
              <Row label="Summary tile">
                <div className="grid w-full gap-3 sm:grid-cols-3">
                  <SummaryTile label="Records" value={53} />
                  <SummaryTile label="Collections" value={5} />
                  <SummaryTile label="Rows deleted" value={4} tone="danger" />
                </div>
              </Row>
              <Row label="Status banner">
                <div className="flex w-full flex-col gap-3">
                  <StatusBanner tone="ok" icon={<Check className="size-4" />}>
                    Versions match — 11.5.1. Ready to migrate.
                  </StatusBanner>
                  <StatusBanner
                    tone="warning"
                    icon={<TriangleAlert className="size-4" />}
                  >
                    Patch versions differ. Review before continuing.
                  </StatusBanner>
                  <StatusBanner tone="error" icon={<X className="size-4" />}>
                    Major versions differ. Migration is blocked.
                  </StatusBanner>
                </div>
              </Row>
            </Section>
          </div>
        </main>
      </TooltipProvider>
    </TranslationProvider>
  );
};

export default ShowcasePage;
