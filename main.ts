import { ZodAny, z } from 'zod'
import { createTypeAlias, printNode, zodToTs } from 'zod-to-ts'
import { mkdir, writeFile, readFile, access } from 'fs/promises'

console.log('this is an experiment around using zod to generate types')

// subtypes schema

const SVector = z.object({ x: z.number(), y: z.number(), z: z.number() })
const SVector2D = SVector.omit({ z: true })

const SFocus = z.object({
  Focus: SVector,
  Rotator: z.object({ Pinch: z.number(), Yaw: z.number(), Roll: z.number() }),
  ArmLength: z.number(),
  CanFocus: z.boolean(),
})

const SSwitch = z.object({
  CheckImg: z.string(),
  CheckText: z.string(),
  UnCheckImg: z.string(),
  UnCheckText: z.string(),
  MinSize: SVector2D,
  FontSize: z.number(),
})

// types schema

const SPOIAdd = z
  .object({
    Tags: z.array(z.string()).describe('标识'),
    Location: SVector.describe('POI地理坐标'),
    Focus: SFocus.describe('聚焦参数'),
    Display: z.boolean().describe('初始可见'),
    Switch: SSwitch.describe('Switch参数'),
  })
  .describe('创建无弹窗POI')

// definitions

const map = {
  'POI.Add': SPOIAdd,
}

// helper

const ue = new Proxy(
  {},
  {
    get(_, key) {
      if (typeof key === 'symbol') {
        return () => Promise.reject(new TypeError('key is symbol'))
      }

      const keyActual = key.replaceAll('_', '.')
      // @ts-expect-error magic baby
      const result = map[keyActual] as ZodAny
      if (result) {
        return (params: unknown) =>
          result.parseAsync(params).then((v) => {
            // some work here
            // return the value directly for now
            return v
          })
      }

      return () =>
        Promise.reject(
          new ReferenceError('Accessing a function that is not defined')
        )
    },
  }
) as unknown as {
  [K in keyof typeof map as K extends `${infer H}.${infer E}`
    ? `${H}_${E}`
    : never]: (params: z.infer<(typeof map)[K]>) => Promise<unknown>
}

// ts will say this is wrong
try {
  await ue.POI_Add({})
} catch (e) {
  console.log('----------------')
  console.log('zod said this is wrong')
  console.log('----------------')
  console.log(e.message)
}

// ts and zod adore people like you who write things as defined
ue.POI_Add({
  Display: true,
  Focus: {
    ArmLength: 100,
    CanFocus: true,
    Focus: { x: 0, y: 0, z: 0 },
    Rotator: { Pinch: 0, Roll: 0, Yaw: 0 },
  },
  Location: { x: 0, y: 0, z: 0 },
  Tags: ['test'],
  Switch: {
    CheckImg: 'test',
    CheckText: 'test',
    FontSize: 12,
    MinSize: { x: 0, y: 0 },
    UnCheckImg: 'test',
    UnCheckText: 'test',
  },
})

// let's try to write them as files

await access('./dist').catch(() => mkdir('./dist'))

await writeFile(
  './dist/types.ts',
  Object.entries(map)
    .reduce((acc, [k, v]) => {
      const id = k.replaceAll('.', '_')
      acc.push(printNode(createTypeAlias(zodToTs(v, id).node, id)))
      return acc
    }, [] as string[])
    .join('\n\n')
)

// and see how that goes

console.log('----------------')
console.log('generated types goes here')
console.log('----------------')
console.log(await readFile('./dist/types.ts', 'utf8'))
console.log('----------------')

// well, let's call it a day

console.log('work done here, see you next time!')
