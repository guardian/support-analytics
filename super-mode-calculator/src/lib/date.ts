import { format } from 'date-fns';

export function toDateString(date: Date): string {
	return format(date, 'yyyy-MM-dd');
}

export function toDatePath(date: Date): string {
	return format(date, 'yyyy/MM/dd/');
}

export function toDateHourString(date: Date): string {
	return format(date, 'yyyy-MM-dd HH:00:00.000');
}

export function toDateHourPath(date: Date): string {
	return format(date, 'yyyy/MM/dd/HH/');
}
