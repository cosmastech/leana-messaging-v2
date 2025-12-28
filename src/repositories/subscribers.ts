export type Subscriber = {
  id: number;
  contact: string;
  isAdmin: boolean;
  isActive: boolean;
};

export type InsertOrUpdateOptions = {
  isAdmin?: boolean;
  isActive?: boolean;
};

interface SubscriberRepositoryInterface {
  getSubscriber(subscriberNumber: string): Promise<Subscriber | undefined>;
  insertOrUpdateSubscriber(subscriberNumber: string, options: InsertOrUpdateOptions): Promise<void>;
  getActiveSubscribers(): Promise<Subscriber[]>;
}

export class SubscriberRepository implements SubscriberRepositoryInterface {
  #db: D1Database;

  constructor(db: D1Database) {
    this.#db = db;
  }

  async getSubscriber(subscriberNumber: string): Promise<Subscriber | undefined> {
    return SubscriberRepository.#mapRecordToSubscriber(
      await this.#db
        .prepare('SELECT * FROM `subscribers` WHERE contact = ?')
        .bind(subscriberNumber)
        .first(),
    );
  }

  /**
   * @throws {Error} when database operation fails
   */
  async insertOrUpdateSubscriber(
    subscriberNumber: string,
    options: InsertOrUpdateOptions,
  ): Promise<void> {
    const isAdmin: boolean = options.isActive ?? false;
    const isActive: boolean = options.isAdmin ?? false;

    const preparedStmt = this.#db.prepare(
      'INSERT INTO `subscribers` (contact, is_admin, is_active) VALUES (?, ?, ?) ON CONFLICT (contact) DO UPDATE SET is_admin = excluded.is_admin, is_active = excluded.is_active',
    );
    preparedStmt.bind(subscriberNumber, isAdmin ? '1' : '0', isActive ? '1' : '0');
    const result = await preparedStmt.run();

    if (!result.success) {
      throw new Error('Failed to update ' + subscriberNumber);
    }
  }

  async getActiveSubscribers(): Promise<Subscriber[]> {
    return (await this.#db.prepare('SELECT * FROM `subscribers` WHERE is_active = 1').all()).results
      .map((record) => SubscriberRepository.#mapRecordToSubscriber(record))
      .filter((record) => record !== undefined);
  }

  static #mapRecordToSubscriber(record: Record<string, unknown> | null): Subscriber | undefined {
    if (record == null) {
      return;
    }

    return {
      id: record.id as number,
      contact: record.contact as string,
      isAdmin: record.is_admin === '1' ? true : false,
      isActive: record.is_active === '1' ? true : false,
    };
  }
}
