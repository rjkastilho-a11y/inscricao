import { z } from 'zod';

export const registrationSchema = z
  .object({
    full_name:            z.string().min(3, 'Nome obrigatório'),
    email:                z.string().email('E-mail inválido'),
    whatsapp:             z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'WhatsApp inválido'),
    birth_date:           z.string().optional(),
    gender:               z.enum(['M', 'F']).optional(),

    is_christian:           z.boolean(),
    is_baptized:            z.boolean().optional(),
    church:                 z.string().optional(),
    pastor:                 z.string().optional(),
    church_role:            z.string().optional(),
    church_role_other:      z.string().optional(),
    godparent:              z.string().optional(),
    godparent_contact:      z.string().optional(),
    pastoral_authorization: z.boolean().optional(),

    health_info:           z.string().optional(),
    emergency_contact:     z.string().optional(),
    emergency_phone:       z.string().optional(),

    payment_method:  z.enum(['pix', 'credit_card', 'cash', 'bank_transfer', 'other']),
    payment_status:  z.enum(['pending', 'paid', 'overdue', 'refunded', 'canceled']).optional(),
    paid_amount:     z.preprocess(
      (v) => (v === '' || v === undefined || v === null || (typeof v === 'number' && isNaN(v))) ? undefined : v,
      z.number().min(0).optional()
    ),
    lot_id:          z.string().uuid().optional(),
    private_notes:   z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.is_christian) {
      if (!data.church) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Igreja obrigatória', path: ['church'] });
      }
      if (!data.pastor) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pastor obrigatório', path: ['pastor'] });
      }
      if (!data.church_role) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cargo obrigatório', path: ['church_role'] });
      }
      if (!data.pastoral_authorization) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Autorização pastoral obrigatória',
          path: ['pastoral_authorization'],
        });
      }
      if (data.church_role === 'Outro' && !data.church_role_other) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Descreva o cargo',
          path: ['church_role_other'],
        });
      }
    }
  });

export type RegistrationFormData = z.infer<typeof registrationSchema>;

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const eventSchema = z.object({
  title: z.string().min(3, 'Título obrigatório'),
  slug: z.string().min(3, 'Slug obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  description: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.string().optional(),
  is_open: z.boolean().default(false),
  max_capacity: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0).default(0),
  cover_url: z.string().optional(),
  terms_text: z.string().optional(),
  terms_enabled: z.boolean().optional(),
});

export const lotSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome do lote obrigatório'),
  description: z.string().optional(),
  price: z.coerce.number().min(0).default(0),
  start_date: z.string().min(1, 'Data de início obrigatória'),
  end_date: z.string().min(1, 'Data de fim obrigatória'),
  max_capacity: z.coerce.number().min(0).optional(),
});

export type LotFormData = z.infer<typeof lotSchema>;

export type EventFormData = z.infer<typeof eventSchema>;

export const paymentStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Em atraso',
  refunded: 'Reembolsado',
  canceled: 'Cancelado',
};

export const paymentMethodLabels: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de crédito',
  cash: 'Dinheiro',
  bank_transfer: 'Transferência',
  other: 'Outro',
};
