import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { formatCurrency } from '@wos/shared'
import type { Transaction } from '@wos/shared'

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
  summary: { marginBottom: 20, padding: 10, backgroundColor: '#f5f5f5' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  summaryLabel: { fontWeight: 'bold' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginTop: 15, marginBottom: 10 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 5, marginBottom: 5 },
  tableRow: { flexDirection: 'row', paddingVertical: 3 },
  colDate: { width: '18%' },
  colType: { width: '12%' },
  colCategory: { width: '18%' },
  colDesc: { width: '32%' },
  colAmount: { width: '20%', textAlign: 'right' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, fontSize: 8, color: '#999', textAlign: 'center' },
})

interface Props {
  title: string
  transactions: Transaction[]
  totalIncome: number
  totalExpense: number
  balance: number
  byCategory: Record<string, { income: number; expense: number }>
}

export function TransactionPDF({ title, transactions, totalIncome, totalExpense, balance, byCategory }: Props) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Income:</Text>
            <Text>{formatCurrency(totalIncome)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Expense:</Text>
            <Text>{formatCurrency(totalExpense)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Balance:</Text>
            <Text>{formatCurrency(balance)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Transactions:</Text>
            <Text>{transactions.length}</Text>
          </View>
        </View>

        {Object.keys(byCategory).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>By Category</Text>
            {Object.entries(byCategory).map(([cat, data]) => (
              <View key={cat} style={styles.catRow}>
                <Text>{cat}</Text>
                <Text>
                  {data.income > 0 ? `+${formatCurrency(data.income)} ` : ''}
                  {data.expense > 0 ? `-${formatCurrency(data.expense)}` : ''}
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Transactions</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colDate}>Date</Text>
          <Text style={styles.colType}>Type</Text>
          <Text style={styles.colCategory}>Category</Text>
          <Text style={styles.colDesc}>Description</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {transactions.map((t) => (
          <View key={t.id} style={styles.tableRow}>
            <Text style={styles.colDate}>{t.date}</Text>
            <Text style={styles.colType}>{t.type === 'income' ? 'IN' : 'EX'}</Text>
            <Text style={styles.colCategory}>{t.category}</Text>
            <Text style={styles.colDesc}>{t.description || '-'}</Text>
            <Text style={[styles.colAmount, { color: t.type === 'income' ? '#16a34a' : '#dc2626' }]}>
              {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
            </Text>
          </View>
        ))}

        <Text style={styles.footer}>
          Generated on {new Date().toLocaleDateString()} • WOS Finance App
        </Text>
      </Page>
    </Document>
  )
}
