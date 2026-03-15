/**
 * Tab icons — web version using phosphor-react.
 * The .native.tsx counterpart uses phosphor-react-native.
 */
import {
  MagnifyingGlass,
  Buildings,
  CurrencyDollar,
  UserCircle,
} from 'phosphor-react'

interface IconProps {
  size?: number
  color?: string
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'
}

export function DiscoverIcon({ size = 24, color, weight = 'regular' }: IconProps) {
  return <MagnifyingGlass size={size} color={color} weight={weight} />
}

export function MyCompanyIcon({ size = 24, color, weight = 'regular' }: IconProps) {
  return <Buildings size={size} color={color} weight={weight} />
}

export function MyPayIcon({ size = 24, color, weight = 'regular' }: IconProps) {
  return <CurrencyDollar size={size} color={color} weight={weight} />
}

export function ProfileIcon({ size = 24, color, weight = 'regular' }: IconProps) {
  return <UserCircle size={size} color={color} weight={weight} />
}
