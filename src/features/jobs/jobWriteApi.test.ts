import { describe, expect, it } from 'vitest'
import {
  buildJobLinePayloads,
  buildJobBillingSummary,
  buildSaveJobWithLinesRpcRequest,
  getJobSaveErrorMessage,
  getJobSaveSessionErrorMessage,
} from './jobWriteApi'

describe('jobWriteApi', () => {
  it('builds a payload per line without fusing concepts or order', () => {
    const payloads = buildJobLinePayloads([
      {
        id: 'line-1',
        sort_order: 1,
        concept: 'Limpieza general',
        quantity: 2,
        unit: 'hora',
        unit_price: 40,
        line_subtotal: 80,
      },
      {
        id: 'line-2',
        sort_order: 2,
        concept: 'Cristales',
        quantity: 1,
        unit: 'servicio',
        unit_price: 25,
        line_subtotal: 25,
      },
      {
        id: 'line-3',
        sort_order: 3,
        concept: 'Desplazamiento',
        quantity: 1,
        unit: 'servicio',
        unit_price: 10,
        line_subtotal: 10,
      },
    ], 'job-1')

    expect(payloads).toHaveLength(3)
    expect(payloads[0]).toMatchObject({ job_id: 'job-1', sort_order: 1, concept: 'Limpieza general' })
    expect(payloads[1]).toMatchObject({ job_id: 'job-1', sort_order: 2, concept: 'Cristales' })
    expect(payloads[2]).toMatchObject({ job_id: 'job-1', sort_order: 3, concept: 'Desplazamiento' })
  })

  it('builds an authenticated RPC request with bearer token and full payload', () => {
    const request = buildSaveJobWithLinesRpcRequest({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      accessToken: 'session-token',
      job: { id: 'job-1', client_id: 'client-1' },
      lines: [
        {
          id: 'line-1',
          job_id: 'job-1',
          concept: 'Limpieza general',
          quantity: 2,
          unit: 'hora',
          unit_price: 40,
          line_subtotal: 80,
        },
        {
          id: 'line-2',
          job_id: 'job-1',
          concept: 'Cristales',
          quantity: 1,
          unit: 'servicio',
          unit_price: 25,
          line_subtotal: 25,
        },
        {
          id: 'line-3',
          job_id: 'job-1',
          concept: 'Sabanas/toallas',
          quantity: 1,
          unit: 'servicio',
          unit_price: 15,
          line_subtotal: 15,
        },
      ],
    })

    expect(request.url).toBe('https://example.supabase.co/rest/v1/rpc/save_job_with_lines')
    expect(request.init).toMatchObject({
      method: 'POST',
      headers: {
        apikey: 'anon-key',
        Authorization: 'Bearer session-token',
        'Content-Type': 'application/json',
      },
    })
    expect(request.init.body).toBe(JSON.stringify({
      p_job: { id: 'job-1', client_id: 'client-1' },
      p_lines: [
        {
          id: 'line-1',
          job_id: 'job-1',
          concept: 'Limpieza general',
          quantity: 2,
          unit: 'hora',
          unit_price: 40,
          line_subtotal: 80,
        },
        {
          id: 'line-2',
          job_id: 'job-1',
          concept: 'Cristales',
          quantity: 1,
          unit: 'servicio',
          unit_price: 25,
          line_subtotal: 25,
        },
        {
          id: 'line-3',
          job_id: 'job-1',
          concept: 'Sabanas/toallas',
          quantity: 1,
          unit: 'servicio',
          unit_price: 15,
          line_subtotal: 15,
        },
      ],
    }))
    const parsedBody = JSON.parse(request.init.body)
    expect(parsedBody.p_lines).toHaveLength(3)
  })

  it('returns the expected session message when there is no active token', () => {
    expect(getJobSaveSessionErrorMessage()).toBe(
      'Tu sesion no esta activa para guardar servicios. Vuelve a iniciar sesion y repite el guardado.',
    )
  })

  it('keeps the first real concept in billing_concept while preserving the multi-line total', () => {
    const summary = buildJobBillingSummary([
      {
        concept: 'Limpieza general',
        quantity: 2,
        unit: 'hora',
        unit_price: 40,
        line_subtotal: 80,
      },
      {
        concept: 'Cristales',
        quantity: 1,
        unit: 'servicio',
        unit_price: 25,
        line_subtotal: 25,
      },
      {
        concept: 'Sabanas/toallas',
        quantity: 1,
        unit: 'servicio',
        unit_price: 10,
        line_subtotal: 10,
      },
    ], 'Limpieza estandar')

    expect(summary).toMatchObject({
      billing_concept: 'Limpieza general',
      billing_quantity: 1,
      billing_unit: 'servicio',
      billing_unit_price: 115,
    })
  })

  it('translates Supabase auth write errors into a user-facing session message', () => {
    expect(getJobSaveErrorMessage({
      message: 'Authentication required for financial writes.',
    })).toBe(getJobSaveSessionErrorMessage())
  })
})
