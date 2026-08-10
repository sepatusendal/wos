import type { TodoItem } from '@wos/shared';
import type { DatabaseAdapter } from '@wos/db';
interface TodoState {
    adapter: DatabaseAdapter | null;
    todos: TodoItem[];
    loading: boolean;
    setAdapter: (adapter: DatabaseAdapter) => void;
    fetchAll: (userId: string) => Promise<void>;
    addTodo: (userId: string, t: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt' | 'order'>) => Promise<void>;
    editTodo: (t: {
        id: string;
        title: string;
        completed: boolean;
        priority: string;
        tags: string[];
        dueDate: string | null;
        notes: string;
    }) => Promise<void>;
    deleteTodo: (id: string) => Promise<void>;
    toggleComplete: (id: string) => Promise<void>;
}
export declare const useTodoStore: import("zustand").UseBoundStore<import("zustand").StoreApi<TodoState>>;
export {};
//# sourceMappingURL=todoStore.d.ts.map